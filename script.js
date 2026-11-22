"use strict";

var papan = document.getElementById("papan");
var teskSkor = document.getElementById("skor");
var teksStatus = document.getElementById("status");
var startBtn = document.getElementById("startBtn");
var pauseBtn = document.getElementById("pauseBtn");
var restartBtn = document.getElementById("restartBtn");

var jumlahBaris = 9;
var jumlahKolom = 17;
var ukuranPapan = 400;
var ukuranSel = Math.min(ukuranPapan / jumlahBaris, ukuranPapan / jumlahKolom);
var kecepatan = 200;

var ctx = papan.getContext("2d");
papan.width = Math.round(jumlahKolom * ukuranSel);
papan.height = Math.round(jumlahBaris * ukuranSel);

var geserBaris = 0;
var geserKolom = 1;
var terakhirBaris = 0;
var terakhirKolom = 1;

var grid = [];
var ular = [];
var apel = [];
var busuk = [];
var jumlahMakan = 0;

var pewaktu = null;

var keadaan = "siap";

// ===== data tambahan khusus animasi =====

// salinan posisi ular SEBELUM langkah terakhir (titik awal animasi)
var ularSebelum = [];

// kapan langkah terakhir terjadi (titik awal waktu animasi), dalam milidetik
var waktuTik = 0;

function buatGrid() {
    grid = [];

    for (var baris = 0; baris < jumlahBaris; baris++) {
        var isiBaris = [];

        for (var kolom = 0; kolom < jumlahKolom; kolom++) {
            isiBaris.push(0);
        }

        grid.push(isiBaris);
    }
}

function cariSelKosong() {
    var baris = Math.floor(Math.random() * jumlahBaris);
    var kolom = Math.floor(Math.random() * jumlahKolom);

    if (grid[baris][kolom] !== 0) {
        baris = Math.floor(Math.random() * jumlahBaris);
        kolom = Math.floor(Math.random() * jumlahKolom);
    }

    return { baris: baris, kolom: kolom };
}

function taruhApel() {
    var sel = cariSelKosong();
    grid[sel.baris][sel.kolom] = 2;
}

function taruhBusuk() {
    var sel = cariSelKosong();
    grid[sel.baris][sel.kolom] = 3;
    busuk.push(sel);

    if (busuk.length > 3) {
        var lama = busuk.shift();
        grid[lama.baris][lama.kolom] = 0;
    }
}

function siapkanGame() {
    berhenti();
    buatGrid();

    ular = [
        { baris: 2, kolom: 1 },
        { baris: 2, kolom: 2 },
        { baris: 2, kolom: 3 }
    ];

    geserBaris = 0;
    geserKolom = 1;
    terakhirBaris = 0;
    terakhirKolom = 1;

    apel = [];
    busuk = [];
    jumlahMakan = 0;

    for (var i = 0; i < ular.length; i++) {
        grid[ular[i].baris][ular[i].kolom] = 1;
    }

    taruhApel();

    // BARU: awalnya tidak ada gerakan yang sedang dianimasikan,
    // jadi posisi "sebelum" disamakan dengan posisi sekarang
    ularSebelum = ular.slice();
    waktuTik = 0;

    keadaan = "siap";
    perbaruiTampilan();
}

// ===== bagian menggambar =====

// kotak dengan sudut membulat (pengganti border-radius di CSS)
function gambarKotakBulat(x, y, lebar, tinggi, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + lebar, y, x + lebar, y + tinggi, radius);
    ctx.arcTo(x + lebar, y + tinggi, x, y + tinggi, radius);
    ctx.arcTo(x, y + tinggi, x, y, radius);
    ctx.arcTo(x, y, x + lebar, y, radius);
    ctx.closePath();
    ctx.fill();
}

// (x, y) = pojok kiri atas sel di kanvas, dalam piksel
// isi sel = ukuran sel dikurangi border 1px di tiap sisi (seperti box-sizing di CSS)
function gambarBadan(x, y) {
    var ukuran = (ukuranSel - 2) * 0.84;
    var jarak = (ukuranSel - ukuran) / 2;

    ctx.fillStyle = "tomato";
    gambarKotakBulat(x + jarak, y + jarak, ukuran, ukuran, 3);
}

function gambarKepala(x, y) {
    var pusatX = x + ukuranSel / 2;
    var pusatY = y + ukuranSel / 2;
    var r = (ukuranSel - 2) / 2;

    ctx.save();

    ctx.translate(pusatX, pusatY);
    ctx.rotate((cariSudutKepala() * Math.PI) / 180);

    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(-r, r);
    ctx.closePath();

    ctx.fillStyle = "rgb(202, 60, 35)";
    ctx.fill();

    ctx.restore();
}

function gambarLingkaran(x, y, warna) {
    var pusatX = x + ukuranSel / 2;
    var pusatY = y + ukuranSel / 2;
    var radius = ((ukuranSel - 2) * 0.64) / 2;

    ctx.beginPath();
    ctx.arc(pusatX, pusatY, radius, 0, Math.PI * 2);
    ctx.fillStyle = warna;
    ctx.fill();
}

// progres animasi: 0 = baru mulai bergeser, 1 = sudah sampai di sel tujuan
function hitungProgres() {
    var t = (Date.now() - waktuTik) / kecepatan;

    if (t > 1) {
        t = 1;
    }

    return t;
}

// posisi piksel segmen ke-i pada progres t.
// segmen berjalan dari posisi lamanya (ularSebelum) ke posisi barunya (ular)
function posisiSegmen(i, t) {
    // kalau ular baru bertambah panjang, segmen baru berangkat dari ujung ular lama
    var indeksLama = Math.min(i, ularSebelum.length - 1);
    var dari = ularSebelum[indeksLama];
    var ke = ular[i];

    return {
        x: (dari.kolom + (ke.kolom - dari.kolom) * t) * ukuranSel,
        y: (dari.baris + (ke.baris - dari.baris) * t) * ukuranSel
    };
}

function gambar() {
    var t = hitungProgres();

    ctx.clearRect(0, 0, papan.width, papan.height);

    // 1. papan dan apel (tidak bergerak, jadi dibaca langsung dari grid)
    for (var baris = 0; baris < jumlahBaris; baris++) {
        for (var kolom = 0; kolom < jumlahKolom; kolom++) {
            var x = kolom * ukuranSel;
            var y = baris * ukuranSel;

            if ((baris + kolom) % 2 === 0) {
                ctx.fillStyle = "aliceblue";
            } else {
                ctx.fillStyle = "rgb(169, 189, 206)";
            }
            ctx.fillRect(x, y, ukuranSel, ukuranSel);

            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, ukuranSel - 1, ukuranSel - 1);

            var isi = grid[baris][kolom];

            if (isi === 2) {
                gambarLingkaran(x, y, "gold");
            } else if (isi === 3) {
                gambarLingkaran(x, y, "purple");
            }
        }
    }

    // 2. ular (digambar dari posisi animasi, bukan dari grid)
    for (var i = 0; i < ular.length - 1; i++) {
        var posisi = posisiSegmen(i, t);
        gambarBadan(posisi.x, posisi.y);
    }

    // kepala digambar paling akhir supaya berada di atas badan
    var posisiKepala = posisiSegmen(ular.length - 1, t);
    gambarKepala(posisiKepala.x, posisiKepala.y);
}

// gambar() sekarang dipanggil terus-menerus (sekitar 60 kali per detik),
// bukan hanya sekali setiap langkah game
function loopGambar() {
    gambar();
    requestAnimationFrame(loopGambar);
}

function cariSudutKepala() {

    if (terakhirKolom === 1) {
        return 0;
    } else if (terakhirKolom === -1) {
        return 180;
    } else if (terakhirBaris === 1) {
        return 90;
    } else if (terakhirBaris === -1) {
        return -90;
    }
}

function langkah() {
    var kepala = ular[ular.length - 1];
    var barisBaru = kepala.baris + geserBaris;
    var kolomBaru = kepala.kolom + geserKolom;

    terakhirBaris = geserBaris;
    terakhirKolom = geserKolom;

    if (
        barisBaru >= 0 &&
        barisBaru < jumlahBaris &&
        kolomBaru >= 0 &&
        kolomBaru < jumlahKolom
    ) {
        if (grid[barisBaru][kolomBaru] === 1 || grid[barisBaru][kolomBaru] === 3) {
            gameOver();
            return;
        }

        // BARU: catat posisi ular sebelum bergerak, dan kapan geraknya dimulai.
        // dua catatan ini yang dipakai gambar() untuk menganimasikan gerakan
        ularSebelum = ular.slice();
        waktuTik = Date.now();

        var makan = grid[barisBaru][kolomBaru] === 2;

        if (!makan) {
            var ekor = ular.shift();
            grid[ekor.baris][ekor.kolom] = 0
        }

        ular.push({ baris: barisBaru, kolom: kolomBaru })
        grid[barisBaru][kolomBaru] = 1;

        if (makan) {
            jumlahMakan = jumlahMakan + 1;
            taruhApel();

            if (jumlahMakan % 3 === 0) {
                taruhBusuk();
            }
        }

        // gambar() tidak lagi dipanggil di sini, sudah ditangani loopGambar
        perbaruiTampilan();
    } else {
        gameOver();
    }
}

function berhenti() {
    if (pewaktu !== null) {
        clearInterval(pewaktu);
        pewaktu = null;
    }
}

function gameOver() {
    berhenti();
    keadaan = "tamat";
    perbaruiTampilan();
}

function perbaruiTampilan() {
    teskSkor.textContent = jumlahMakan;

    if (keadaan === "siap") {
        teksStatus.textContent = "Siap";
    } else if (keadaan === "jalan") {
        teksStatus.textContent = "Jalan";
    } else if (keadaan === "jeda") {
        teksStatus.textContent = "Jeda";
    } else if (keadaan === "tamat") {
        teksStatus.textContent = "Game Over";
    }

    startBtn.disabled = keadaan === "jalan" || keadaan === "tamat";
    pauseBtn.disabled = keadaan !== "jalan";
}

function mulai() {
    if (keadaan !== "siap" && keadaan !== "jeda") {
        return;
    }

    pewaktu = setInterval(langkah, kecepatan);
    keadaan = "jalan"
    perbaruiTampilan();
}

function jeda() {
    if (keadaan !== "jalan") {
        return;
    }

    berhenti();
    keadaan = "jeda";
    perbaruiTampilan();
}

function ulang() {
    siapkanGame();
    perbaruiTampilan();
}

startBtn.addEventListener("click", mulai);
pauseBtn.addEventListener("click", jeda);
restartBtn.addEventListener("click", ulang);

document.addEventListener("keydown", function (e) {
    if (keadaan !== "jalan") {
        return;
    }

    var tombol = e.key.toLowerCase();

    if (tombol === "w" && terakhirBaris !== 1) {
        geserBaris = -1;
        geserKolom = 0;
    }

    if (tombol === "s" && terakhirBaris !== -1) {
        geserBaris = 1;
        geserKolom = 0;
    }

    if (tombol === "a" && terakhirKolom !== 1) {
        geserBaris = 0;
        geserKolom = -1;
    }

    if (tombol === "d" && terakhirKolom !== -1) {
        geserBaris = 0;
        geserKolom = 1;
    }
})

siapkanGame();
loopGambar();