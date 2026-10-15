/* ==========================================================
   HOME.JS - HALAMAN UTAMA TERRORSTREAM
   Data film diambil dari TMDB API (themoviedb.org)
   ========================================================== */

// ---------- 1. PENGATURAN ----------
const API_KEY = "5675db644132bff8db5ff739e4cb76c8";                        // ganti dengan API key TMDB milikmu
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_POSTER = "https://image.tmdb.org/t/p/w500";   // alamat dasar gambar poster
const IMG_BACKDROP = "https://image.tmdb.org/t/p/w1280"; // alamat dasar gambar banner

let heroMovies = [];     // daftar film untuk banner (hero)
let heroIndex = 0;       // film ke-berapa yang sedang tampil di hero
let currentHeroId = null;

// Watchlist disimpan di browser (localStorage)
let watchlist = [];
try {
  watchlist = JSON.parse(localStorage.getItem("watchlist")) || [];
} catch (e) {
  watchlist = [];
}

// ---------- 2. ELEMEN HTML ----------
const grid = document.getElementById("movie-grid");
const sectionTitle = document.getElementById("section-title");
const searchInput = document.getElementById("search-input");

const heroEl = document.getElementById("hero");
const heroTitle = document.getElementById("hero-title");
const heroRating = document.getElementById("hero-rating");
const heroDetail = document.getElementById("hero-detail");
const heroDesc = document.getElementById("hero-desc");
const btnHeroWatchlist = document.getElementById("btn-hero-watchlist");


// ---------- 3. FUNGSI BANTU ----------

// Ambil data JSON dari TMDB
async function getJSON(path, extraParams = "") {
  const url = `${BASE_URL}${path}?api_key=${API_KEY}&language=en-US${extraParams}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal mengambil data: " + res.status);
  return res.json();
}

// Cegah karakter berbahaya masuk ke HTML (keamanan dasar)
function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function saveWatchlist() {
  try {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  } catch (e) { /* abaikan jika penyimpanan diblokir */ }
}

function isInWatchlist(id) {
  return watchlist.includes(id);
}


// ---------- 4. DAFTAR FILM (GRID) ----------
function showGrid(movies) {
  // Hanya film yang punya poster
  const list = movies.filter(m => m.poster_path).slice(0, 14);   // 14 film = 2 baris x 7

  if (list.length === 0) {
    grid.innerHTML = `<p class="empty">Film tidak ditemukan.</p>`;
    return;
  }

  // Buat satu kartu untuk setiap film
  grid.innerHTML = list.map(m => `
    <div class="movie-card" data-id="${m.id}">
      <img src="${IMG_POSTER + m.poster_path}" alt="${esc(m.title)}">
      <span class="rating"><i class="fa-solid fa-star"></i> ${m.vote_average.toFixed(1)}/10</span>
      <button class="bookmark ${isInWatchlist(m.id) ? "active" : ""}" aria-label="Watchlist">
        <i class="fa-solid fa-bookmark"></i>
      </button>
    </div>
  `).join("");
}

// Klik bookmark pada kartu (event delegation: satu listener untuk semua kartu)
grid.addEventListener("click", (e) => {
  const btn = e.target.closest(".bookmark");
  if (!btn) return;
  const id = Number(btn.closest(".movie-card").dataset.id);
  toggleWatchlist(id);
  btn.classList.toggle("active", isInWatchlist(id));
  updateHeroWatchlistButton();
});


// ---------- 5. WATCHLIST ----------
function toggleWatchlist(id) {
  if (isInWatchlist(id)) {
    watchlist = watchlist.filter(x => x !== id);   // hapus
  } else {
    watchlist.push(id);                            // tambah
  }
  saveWatchlist();
}

function updateHeroWatchlistButton() {
  btnHeroWatchlist.classList.toggle("active", isInWatchlist(currentHeroId));
}

btnHeroWatchlist.addEventListener("click", () => {
  toggleWatchlist(currentHeroId);
  updateHeroWatchlistButton();

  // Samakan tampilan bookmark pada kartu (jika film itu ada di grid)
  const card = grid.querySelector(`[data-id="${currentHeroId}"] .bookmark`);
  if (card) card.classList.toggle("active", isInWatchlist(currentHeroId));
});


// ---------- 6. HERO (BANNER) ----------
async function showHero(index) {
  // Putar kembali ke awal/akhir jika melewati batas
  heroIndex = (index + heroMovies.length) % heroMovies.length;
  const movie = heroMovies[heroIndex];
  currentHeroId = movie.id;

  // Info dasar (sudah ada di data daftar film)
  heroEl.style.setProperty("--hero-bg", `url(${IMG_BACKDROP + movie.backdrop_path})`);
  heroTitle.textContent = movie.title;
  heroRating.textContent = movie.vote_average.toFixed(1) + "/10";
  heroDesc.textContent = movie.overview;
  heroDetail.textContent = "";
  updateHeroWatchlistButton();

  // Info tambahan (genre & durasi) harus ambil dari endpoint detail
  try {
    const detail = await getJSON(`/movie/${movie.id}`);
    if (currentHeroId !== movie.id) return;   // user sudah pindah film, abaikan

    const genres = detail.genres.slice(0, 2).map(g => g.name).join(" | ");
    const year = (movie.release_date || "").slice(0, 4);
    const runtime = detail.runtime
      ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
      : "";

    // Gabungkan bagian yang ada saja
    heroDetail.textContent = [genres, year, runtime].filter(Boolean).map(t => "| " + t).join(" ");
  } catch (err) {
    console.error(err);
  }
}

// Tombol panah
document.getElementById("btn-prev").addEventListener("click", () => showHero(heroIndex - 1));
document.getElementById("btn-next").addEventListener("click", () => showHero(heroIndex + 1));

// Tombol Trailer: cari video trailer YouTube lalu buka di tab baru
document.getElementById("btn-trailer").addEventListener("click", async () => {
  try {
    const data = await getJSON(`/movie/${currentHeroId}/videos`);
    const trailer = data.results.find(v => v.site === "YouTube" && v.type === "Trailer");
    if (trailer) {
      window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank");
    } else {
      alert("Trailer tidak tersedia.");
    }
  } catch (err) {
    alert("Gagal memuat trailer.");
  }
});


// ---------- 7. SEARCH ----------
searchInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const query = searchInput.value.trim();
  if (query === "") {
    loadHorror();               // kolom kosong -> tampilkan film horor lagi
    return;
  }

  try {
    const data = await getJSON("/search/movie", `&query=${encodeURIComponent(query)}`);
    sectionTitle.textContent = `Hasil pencarian: "${query}"`;
    showGrid(data.results);
  } catch (err) {
    grid.innerHTML = `<p class="empty">Gagal memuat data.</p>`;
  }
});


// ---------- 8. MEMUAT FILM AWAL ----------
async function loadHorror() {
  try {
    // with_genres=27 -> genre Horror
    const data = await getJSON("/discover/movie", "&with_genres=27&sort_by=popularity.desc");

    sectionTitle.textContent = "Popular Horror";
    showGrid(data.results);

    // 5 film pertama dijadikan banner hero (hanya yang punya gambar backdrop)
    heroMovies = data.results.filter(m => m.backdrop_path).slice(0, 5);
    if (heroMovies.length) showHero(0);
  } catch (err) {
    console.error(err);
    heroTitle.textContent = "Gagal memuat data";
    heroDesc.textContent = "Periksa API key dan koneksi internet kamu.";
  }
}

loadHorror();
