/**
 * Agora RTC utility functions
 * Handles initialization, join/leave, media controls
 */

import AgoraRTC from "agora-rtc-sdk-ng";

export const agoraConfig = {
  agoraAppId: null,
  rtcClient: null,
  localAudioTrack: null,
  localVideoTrack: null,
};

/**
 * Fetch Agora config and initialize client
 * @param {number} uid - User ID
 * @param {string} channelName - Channel name
 * @param {string} token - Optional token for authentication
 * @returns {Promise<any>}
 */
export const initializeAgoraClient = async () => {
  try {
    // Prefer backend config, then fall back to env for local compatibility.
    let appId = "";
    try {
      const response = await fetch("/api/agora/config");
      if (response.ok) {
        const configData = await response.json();
        appId = configData?.appId || "";
      }
    } catch {
      // Intentionally ignored; env fallback handles local cases.
    }

    agoraConfig.agoraAppId = appId || import.meta.env.VITE_AGORA_APP_ID || "";
    if (!agoraConfig.agoraAppId) {
      throw new Error("Agora App ID is not configured.");
    }

    // Initialize RTC client
    agoraConfig.rtcClient = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8",
    });

    // Setup event listeners
    agoraConfig.rtcClient.on("user-published", async (user) => {
      console.log("User published:", user);
    });

    agoraConfig.rtcClient.on("user-unpublished", (user) => {
      console.log("User unpublished:", user);
    });

    agoraConfig.rtcClient.on("user-left", (user) => {
      console.log("User left:", user);
    });

    return {
      rtcClient: agoraConfig.rtcClient,
      appId: agoraConfig.agoraAppId,
    };
  } catch (error) {
    console.error("Failed to initialize Agora client:", error);
    throw error;
  }
};

/**
 * Generate Agora token from backend
 * @param {string} channelName - Channel name
 * @param {number} uid - User ID
 * @param {object} options - API options
 * @returns {Promise<string>} Token
 */
export const generateAgoraToken = async (channelName, uid, options = {}) => {
  const authHeader = options.token
    ? { Authorization: `Bearer ${options.token}` }
    : {};

  try {
    const primary = await fetch(
      `/api/agora/token?channelName=${encodeURIComponent(channelName)}&uid=${uid}`,
      {
        method: "POST",
        headers: authHeader,
      },
    );

    if (primary.ok) {
      const data = await primary.json();
      return data.token || "";
    }

    // Compatibility fallback for telemedicine sample backend shape.
    const fallback = await fetch(
      `/api/video/token?channel=${encodeURIComponent(channelName)}&uid=${uid}&role=1`,
      {
        method: "GET",
        headers: authHeader,
      },
    );

    if (!fallback.ok) {
      throw new Error(`Failed to generate token: ${fallback.statusText}`);
    }

    const fallbackData = await fallback.json();
    return fallbackData.token || "";
  } catch (error) {
    console.error("Failed to generate token:", error);
    return "";
  }
};

/**
 * Create and publish local tracks
 * @param {object} rtcClient - RTC client instance
 * @param {object} constraints - Media constraints {video, audio}
 * @returns {Promise<{audioTrack, videoTrack}>}
 */
export const createLocalTracks = async (
  rtcClient,
  constraints = { video: true, audio: true },
) => {
  try {
    const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
      {
        audioConfig: "high_quality_stereo",
        videoConfig: constraints.video
          ? { frameRate: 30, resolution: "720p" }
          : null,
      },
      constraints.audio ? {} : null,
    );

    // Store tracks for later use
    if (tracks[0]) agoraConfig.localAudioTrack = tracks[0];
    if (tracks[1]) agoraConfig.localVideoTrack = tracks[1];

    return {
      audioTrack: tracks[0],
      videoTrack: tracks[1],
    };
  } catch (error) {
    console.error("Failed to create tracks:", error);
    throw error;
  }
};

/**
 * Join channel and publish local tracks
 * @param {object} rtcClient - RTC client instance
 * @param {string} channelName - Channel name
 * @param {number} uid - User ID
 * @param {string} token - Agora token
 * @param {object} tracks - Local tracks {audioTrack, videoTrack}
 * @returns {Promise<void>}
 */
export const joinChannel = async (
  rtcClient,
  channelName,
  uid,
  token,
  tracks,
) => {
  try {
    await rtcClient.join(agoraConfig.agoraAppId, channelName, token, uid);

    if (tracks.audioTrack) {
      await rtcClient.publish(tracks.audioTrack);
    }
    if (tracks.videoTrack) {
      await rtcClient.publish(tracks.videoTrack);
    }

    console.log("Successfully joined channel:", channelName);
  } catch (error) {
    console.error("Failed to join channel:", error);
    throw error;
  }
};

/**
 * Leave channel and cleanup
 * @param {object} rtcClient - RTC client instance
 * @returns {Promise<void>}
 */
export const leaveChannel = async (rtcClient) => {
  try {
    // Stop and close tracks
    if (agoraConfig.localAudioTrack) {
      agoraConfig.localAudioTrack.stop();
      agoraConfig.localAudioTrack.close();
    }
    if (agoraConfig.localVideoTrack) {
      agoraConfig.localVideoTrack.stop();
      agoraConfig.localVideoTrack.close();
    }

    // Leave channel
    await rtcClient.leave();
    console.log("Successfully left channel");
  } catch (error) {
    console.error("Failed to leave channel:", error);
    throw error;
  }
};

/**
 * Toggle audio track
 * @param {boolean} enabled - Enable or disable
 * @returns {void}
 */
export const toggleAudio = async (enabled) => {
  if (agoraConfig.localAudioTrack) {
    await agoraConfig.localAudioTrack.setEnabled(enabled);
  }
};

/**
 * Toggle video track
 * @param {boolean} enabled - Enable or disable
 * @returns {void}
 */
export const toggleVideo = async (enabled) => {
  if (agoraConfig.localVideoTrack) {
    await agoraConfig.localVideoTrack.setEnabled(enabled);
  }
};

/**
 * Get remote users in channel
 * @param {object} rtcClient - RTC client instance
 * @returns {Array} Remote users
 */
export const getRemoteUsers = (rtcClient) => {
  return rtcClient.remoteUsers || [];
};

/**
 * Subscribe to remote user's audio and video
 * @param {object} rtcClient - RTC client instance
 * @param {object} user - Remote user object
 * @param {string} mediaType - 'audio' or 'video'
 * @returns {Promise<void>}
 */
export const subscribeToUser = async (rtcClient, user, mediaType) => {
  try {
    await rtcClient.subscribe(user, mediaType);
    console.log(`Subscribed to ${mediaType} from user ${user.uid}`);
  } catch (error) {
    console.error(`Failed to subscribe to ${mediaType}:`, error);
  }
};

/**
 * Unsubscribe from remote user
 * @param {object} rtcClient - RTC client instance
 * @param {object} user - Remote user object
 * @param {string} mediaType - 'audio' or 'video'
 * @returns {Promise<void>}
 */
export const unsubscribeFromUser = async (rtcClient, user, mediaType) => {
  try {
    await rtcClient.unsubscribe(user, mediaType);
    console.log(`Unsubscribed from ${mediaType} from user ${user.uid}`);
  } catch (error) {
    console.error(`Failed to unsubscribe from ${mediaType}:`, error);
  }
};

export default {
  initializeAgoraClient,
  generateAgoraToken,
  createLocalTracks,
  joinChannel,
  leaveChannel,
  toggleAudio,
  toggleVideo,
  getRemoteUsers,
  subscribeToUser,
  unsubscribeFromUser,
};
