import {
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import authSpotify from "./spotify.js";

const spotifyApi = await authSpotify();

function msToTime(duration) {
  var seconds = parseInt((duration / 1000) % 60),
    minutes = parseInt((duration / (1000 * 60)) % 60);
  return minutes + ":" + (seconds < 10 ? "0" + seconds : seconds);
}

async function getSong() {
  try {
    const data = await spotifyApi.getMyCurrentPlaybackState();
    if (!data.body || !data.body.item || data.body.is_playing == false) {
      return null;
    }
    return {
      name: data.body.item.name,
      artists: data.body.item.artists,
      album: data.body.item.album.name,
      progress: data.body.progress_ms,
      duration: data.body.item.duration_ms,
      id: data.body.item.id,
    };
  } catch (error) {
    console.log("SPOTIFY ERROR: ", error);
    return null;
  }
}

let lastSong = null;
let lastUpdate = 0;
async function updateStatusWithSongOrFallbackToRandomStatus(conn) {
  const song = await getSong();
  if (!song) {
    if (lastSong) {
      lastSong = null;
    } else if (Date.now() - lastUpdate > 3600 * 1000) {
      lastUpdate = Date.now();
    } else {
      return;
    }
    // if no song is playing, update status with random status
    const randomStatus = [
      "I am delusional",
      "Currently listening to ABSOLUTELY NOTHING",
      "Probably having a mental breakdown",
      "My brain is like an multithreaded program and the IO thread is constantly writing all IO operations to stdout so its just a complete mess",
      "Hello you, yes you",
      "apa yang sedang anda lihat?",
      "berusaha sebaik mungkin (╥﹏╥)",
      "I think... (thinking was a mistake)"
    ];
    await conn.updateProfileStatus(
      randomStatus[Math.floor(Math.random() * randomStatus.length)]
    );
    lastUpdate = Date.now();
    return;
  }
  if (song.id != lastSong || Date.now() - lastUpdate > 15 * 1000) {
    // console.log("Updating!", song, lastSong, lastUpdate, Date.now(), Date.now() - lastUpdate)
    // if song is playing, update status with song
    const feat =
      song.artists.length > 1
        ? `(feat. ${song.artists
            .slice(1)
            .map((e) => e.name)
            .join(", ")})`
        : "";
    const progress = `${msToTime(song.progress)}/${msToTime(song.duration)}`;
    await conn.updateProfileStatus(
      `lagi denger "${song.name}" oleh ${song.artists[0].name} ${feat} (${progress})`
    );
    lastUpdate = Date.now();
    lastSong = song.id;
  }
}

async function ConnectWhatsapp() {
  // utility function to help save the auth state in a single folder
  // this function serves as a good guide to help write auth & key states for SQL/no-SQL databases, which I would recommend in any production grade system
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  // will use the given state to connect
  // so if valid credentials are available -- it'll connect without QR
  const conn = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  conn.ev.on('creds.update', saveCreds);

  // this will update the status every couple of seconds
  setInterval(() => updateStatusWithSongOrFallbackToRandomStatus(conn), 2000);
}

await ConnectWhatsapp();

while (true) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
