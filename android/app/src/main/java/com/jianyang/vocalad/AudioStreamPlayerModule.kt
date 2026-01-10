package com.allenma.vocalad

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AudioStreamPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var audioTrack: AudioTrack? = null
    private var isPlaying = false

    override fun getName(): String {
        return "AudioStreamPlayer"
    }

    @ReactMethod
    fun initialize(sampleRate: Int, channels: Int) {
        val channelConfig = if (channels == 1) {
            AudioFormat.CHANNEL_OUT_MONO
        } else {
            AudioFormat.CHANNEL_OUT_STEREO
        }

        val bufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            channelConfig,
            AudioFormat.ENCODING_PCM_16BIT
        )

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelConfig)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize * 4) // Larger buffer for smoother playback
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack?.play()
        isPlaying = true
    }

    @ReactMethod
    fun writeBuffer(base64Data: String) {
        if (!isPlaying || audioTrack == null) {
            return
        }

        try {
            // Decode base64 to byte array
            val pcmData = Base64.decode(base64Data, Base64.DEFAULT)

            // Write directly to AudioTrack (sequential, no time-based scheduling)
            audioTrack?.write(pcmData, 0, pcmData.size)
        } catch (e: Exception) {
            println("❌ Error writing audio buffer: ${e.message}")
        }
    }

    @ReactMethod
    fun stop() {
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
        isPlaying = false
    }
}
