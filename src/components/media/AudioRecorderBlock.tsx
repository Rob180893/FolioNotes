import React, { useEffect, useRef, useState } from 'react';
import { Mic, RotateCcw, Square, Volume2 } from 'lucide-react';
import type { AudioData } from '../../types/notes';

interface AudioRecorderBlockProps {
  audio?: AudioData;
  onSaveAudio: (audio: AudioData) => void;
}

export const AudioRecorderBlock: React.FC<AudioRecorderBlockProps> = ({ audio, onSaveAudio }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Gravação de áudio não suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      elapsedRef.current = 0;
      setElapsedSec(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (dataUrl) {
            onSaveAudio({
              dataUrl,
              durationSec: Math.max(1, elapsedRef.current),
              label: audio?.label || `Nota de voz (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
            });
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSec(elapsedRef.current);
      }, 1000);
    } catch {
      setErrorMsg('Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/50 p-3.5">
      {audio?.dataUrl && !isRecording ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <input
                type="text"
                value={audio.label}
                onChange={(e) => onSaveAudio({ ...audio, label: e.target.value })}
                className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none"
                aria-label="Título da nota de áudio"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {formatDuration(audio.durationSec)}
              </span>
              <button
                type="button"
                onClick={startRecording}
                className="no-print inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
                title="Regravar áudio"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regravar</span>
              </button>
            </div>
          </div>
          <audio controls src={audio.dataUrl} className="w-full h-9" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isRecording ? (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            ) : (
              <Mic className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {isRecording ? 'Gravando nota de áudio...' : 'Gravar nota de áudio na página'}
            </span>
            {isRecording && (
              <span className="font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400">
                {formatDuration(elapsedSec)}
              </span>
            )}
          </div>

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar e Salvar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Iniciar Gravação</span>
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{errorMsg}</p>
      )}
    </div>
  );
};
