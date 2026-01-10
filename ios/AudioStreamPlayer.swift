import Foundation
import AVFoundation

@objc(AudioStreamPlayer)
class AudioStreamPlayer: NSObject {
  private var audioEngine: AVAudioEngine?
  private var playerNode: AVAudioPlayerNode?
  private var audioFormat: AVAudioFormat?
  private var isPlaying = false

  override init() {
    super.init()
  }

  @objc
  func initialize(_ sampleRate: NSNumber, channels: NSNumber) {
    let rate = sampleRate.doubleValue
    let channelCount = channels.uint32Value

    audioEngine = AVAudioEngine()
    playerNode = AVAudioPlayerNode()

    guard let engine = audioEngine, let player = playerNode else {
      return
    }

    // Create audio format (PCM, 16kHz or 24kHz, mono)
    audioFormat = AVAudioFormat(
      commonFormat: .pcmFormatFloat32,
      sampleRate: rate,
      channels: channelCount,
      interleaved: false
    )

    guard let format = audioFormat else {
      return
    }

    // Attach and connect player node
    engine.attach(player)
    engine.connect(player, to: engine.mainMixerNode, format: format)

    // Start audio engine
    do {
      try engine.start()
      player.play()
      isPlaying = true
    } catch {
      print("❌ Failed to start audio engine: \(error)")
    }
  }

  @objc
  func writeBuffer(_ base64Data: String) {
    guard let player = playerNode,
          let format = audioFormat,
          isPlaying else {
      return
    }

    // Decode base64 to Data
    guard let data = Data(base64Encoded: base64Data) else {
      print("❌ Failed to decode base64 audio data")
      return
    }

    // Convert to Int16 array
    let int16Count = data.count / 2
    let int16Array = data.withUnsafeBytes { ptr in
      Array(ptr.bindMemory(to: Int16.self))
    }

    // Convert Int16 to Float32 (-1.0 to 1.0)
    var float32Array = [Float](repeating: 0, count: int16Count)
    for i in 0..<int16Count {
      float32Array[i] = Float(int16Array[i]) / 32768.0
    }

    // Create AVAudioPCMBuffer
    guard let buffer = AVAudioPCMBuffer(
      pcmFormat: format,
      frameCapacity: AVAudioFrameCount(int16Count)
    ) else {
      print("❌ Failed to create audio buffer")
      return
    }

    buffer.frameLength = AVAudioFrameCount(int16Count)

    // Copy data to buffer
    if let channelData = buffer.floatChannelData {
      for i in 0..<int16Count {
        channelData[0][i] = float32Array[i]
      }
    }

    // Schedule buffer for playback (sequential, no time-based scheduling)
    player.scheduleBuffer(buffer, completionHandler: nil)
  }

  @objc
  func stop() {
    playerNode?.stop()
    audioEngine?.stop()
    isPlaying = false
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
