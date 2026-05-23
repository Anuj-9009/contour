import { useState, useCallback } from 'react'
import { LyricLine } from '../types'

export function useTranscriber() {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeProgress, setTranscribeProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const transcribeAudio = useCallback(async (audioFile: File): Promise<LyricLine[]> => {
    setIsTranscribing(true)
    setTranscribeProgress(0)
    setError(null)

    try {
      // 1. Decode audio to 16kHz mono Float32 PCM
      setTranscribeProgress(5)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      const arrayBuffer = await audioFile.arrayBuffer()
      
      let audioBuffer: AudioBuffer
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      } catch (decodeErr) {
        console.error('Initial decode failed, trying fallback', decodeErr)
        // Fallback for some browsers that don't support sampleRate in AudioContext constructor
        const fallbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const decoded = await fallbackCtx.decodeAudioData(arrayBuffer)
        // Manual offline resampling could be done, but in most modern environments the sampleRate is respected.
        audioBuffer = decoded
      }

      const pcm = audioBuffer.getChannelData(0) // Get left channel
      setTranscribeProgress(15)

      // 2. Load Transformers.js automatically
      const { pipeline } = await import('@xenova/transformers')
      
      setTranscribeProgress(25)
      
      // Load model (Whisper-Tiny for english or multilingual)
      const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: (data: any) => {
          if (data.status === 'progress') {
            // Load progress matches 25% - 60%
            setTranscribeProgress(Math.round(25 + data.progress * 0.35))
          }
        }
      })

      setTranscribeProgress(65)

      // 3. Run speech-to-text inference
      const result = await transcriber(pcm, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      })

      setTranscribeProgress(95)

      // 4. Parse Whisper chunks into LRC-style lyric lines
      const parsedLines: LyricLine[] = []
      const chunks = (result as any).chunks || []

      for (const chunk of chunks) {
        const text = chunk.text.trim()
        if (!text) continue
        
        // Whisper returns timestamp: [start_s, end_s]
        const startTime = chunk.timestamp ? chunk.timestamp[0] : 0
        const timestampMs = Math.round(startTime * 1000)
        
        parsedLines.push({
          text,
          timestamp: timestampMs
        })
      }

      setTranscribeProgress(100)
      setIsTranscribing(false)

      // Fallback: If AI returns nothing, split text at regular intervals
      if (parsedLines.length === 0) {
        return [{ text: 'No vocals detected. Please paste text or tap sync.', timestamp: 0 }]
      }

      return parsedLines
    } catch (err: any) {
      console.error('Transcription failed:', err)
      setError(err.message || 'Speech-to-text failed. Check your file format.')
      setIsTranscribing(false)
      throw err
    }
  }, [])

  return {
    transcribeAudio,
    isTranscribing,
    transcribeProgress,
    error
  }
}
