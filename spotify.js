import SpotifyWebApi from "spotify-web-api-node";
import express from "express";
import fs from "fs";
import prompt from "prompt-sync";

export default async function authSpotify() {
  const scopes = ["user-read-playback-state"];
  // load the credentials from a json file
  const config = JSON.parse(fs.readFileSync("spotifyConfig.json"));
  var spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirect + ":" + config.redirectPort,
  });

  async function getToken() {
    var authorizeURL = spotifyApi.createAuthorizeURL(scopes, "poopsicle");
    console.log(authorizeURL);

    let spotifyCode = undefined;

    if (config.headless) {
      const url = prompt()("Enter the URL you were redirected to: ");
      const parsedUrl = new URL(url);
      spotifyCode = parsedUrl.searchParams.get("code");
    } else {
      const app = express();
      const port = config.redirectPort;
      let server = null;

      app.get("/", (req, res) => {
        if (req.query.code) {
          spotifyCode = req.query.code;
          res.send("Hello World!");
          console.log("Code Received! Closing server");
          server.close();
        }
      });

      server = app.listen(port, () => {
        console.log(`Code retriever listening on port ${port}`);
      });

      while (spotifyCode == undefined) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const accessToken = await spotifyApi.authorizationCodeGrant(spotifyCode);

    return {
      accessToken: accessToken.body["access_token"],
      refreshToken: accessToken.body["refresh_token"],
    };
  }

  const getRefreshedToken = async () => {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body["access_token"]);
    tokens.accessToken = data.body["access_token"];
    fs.writeFileSync("spotifyTokens.json", JSON.stringify(tokens));
  }

  // load stored token in file
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync("spotifyTokens.json").toString());
    spotifyApi.setAccessToken(tokens.accessToken);
    spotifyApi.setRefreshToken(tokens.refreshToken);
    // try to print username
    await getRefreshedToken();
    const data = await spotifyApi.getMe();
    console.log("Spotify Logged in as", data.body.display_name);
  } catch (error) {
    tokens = await getToken();
    fs.writeFileSync("spotifyTokens.json", JSON.stringify(tokens));
    spotifyApi.setAccessToken(tokens.accessToken);
    spotifyApi.setRefreshToken(tokens.refreshToken);
    // try to print username
    const data = await spotifyApi.getMe();
    console.log("Spotify Logged in as", data.body.display_name);
  }

  // refresh token on an interval
  setInterval(getRefreshedToken, 1000 * 1000); // refresh every 1ks
  return spotifyApi;
}
