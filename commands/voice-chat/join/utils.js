import pkg from "@discordjs/opus";
import whisper from "whisper-node";
import toWav from "audiobuffer-to-wav";
const { OpusEncoder } = pkg;

import {
  AudioPlayerStatus,
  EndBehaviorType,
  createAudioResource,
  createAudioPlayer,
} from "@discordjs/voice";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { talkToAI } from "./talkToAI.js";

const REQUEST_CONFIG = {
  encoding: "LINEAR16",
  sampleRateHertz: 48000,
  languageCode: "en-GB",
  audioChannelCount: 2,
};

export class VoiceTranscriptor {
  connection;
  receiver;

  message;
  commandsChannel;

  time;
  messageId;
  constructor(connection) {
    this.connection = connection;
    this.receiver = this.connection.receiver;
  }

  async listen(userId) {
    try {
      console.log(`Listening to ${userId} 🦎`);
      this.dataSubscriptions(userId);
    } catch (error) {
      console.log(error);
    }
  }

  dataSubscriptions(userId) {
    let subscription = this.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    });

    const buffers = [];
    const encoder = new OpusEncoder(48000, 2);

    subscription.on("data", (chunk) => {
      // console.log(buffers.length);

      buffers.push(encoder.decode(chunk));
    }); // Subscription on when we receive data

    subscription.once("end", async () => {
      if (buffers.length < 50) {
        return console.log("Audio is too short", buffers.length);
      }

      this.time = performance.now();

      const outputPath = this.getOutputPath(buffers);
      const transcription = await this.getTranscription(outputPath);
      console.log(transcription);

      if (transcription.length > 5) return this.AISpeech(transcription); // The transcription has a minimum of 5 letters
    }); // Subscription on when user stops talking
  }

  async getTranscription(tempFileName) {
    try {
      const response = await whisper(tempFileName);

      const transcription = response
        .map((result) => {
          return result.speech;
        })
        .join("\n");

      return transcription;
    } catch (error) {
      console.log(error);
    }
  }

  async AISpeech(transcription) {
    try {
      // Call ChatGPT API
      const text = await talkToAI(transcription);

      console.log("AI:", text);

      const textToSpeech = new TextToSpeechClient();
      const request = {
        input: { text },
        voice: {
          languageCode: "en-GB", // Change it to the language you want
          ssmlGender: "FEMALE", // Gender
        },
        audioConfig: { audioEncoding: "MP3" },
      };

      const [response] = await textToSpeech.synthesizeSpeech(request);

      fs.writeFileSync("./assets/output.mp3", response.audioContent, "binary");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const resource = createAudioResource(
        join(__dirname, "../../../assets/output.mp3")
      );

      const player = createAudioPlayer();

      this.playerSubcription(player);

      const delay = performance.now() - (this.time || 0);
      const delaySeconds = delay / 1000;
      const delayRounded = delaySeconds.toFixed(2);
      console.log(`This took ${delayRounded}s 👺⌚`);

      // Start speaking
      this.connection.subscribe(player);
      player.play(resource);
    } catch (err) {
      console.log(err);
    }
  }

  playerSubcription(player) {
    player.on("error", (error) => {
      console.log("Error:", error.message);
      this.connection.destroy();
    });

    player.on(AudioPlayerStatus.Idle, () => {
      player.removeAllListeners();
    });
  }

  getOutputPath(buffers) {
    const concatenatedBuffer = Buffer.concat(buffers);
    const wavBuffer = toWav(concatenatedBuffer);
    const outputPath = "./assets/input.wav";
    fs.writeFileSync(outputPath, wavBuffer);
    return outputPath;
  }
}
