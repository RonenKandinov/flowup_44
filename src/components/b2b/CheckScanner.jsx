import React, { useRef, useState } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

/**
 * Mobile-first check scanner.
 * Uses the device camera (capture="environment") on phones, falls back to file upload on desktop.
 * Sends the image to UploadFile → checkOcrExtract, then surfaces extracted fields for confirmation.
 */
export default function CheckScanner({ onExtracted }) {
    const fileRef = useRef(null);
    const [phase, setPhase] = useState('idle'); // idle | uploading | extracting | done | error
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState('');

    const handleFile = async (file) => {
        if (!file) return;
        setError('');
        setPreviewUrl(URL.createObjectURL(file));
        setPhase('uploading');

        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        setPhase('extracting');
        const res = await base44.functions.invoke('checkOcrExtract', { check_image_url: file_url });
        if (!res?.data?.success) {
            setPhase('error');
            setError(res?.data?.error || 'שגיאת זיהוי');
            return;
        }

        setPhase('done');
        onExtracted?.({ ...res.data.extracted, check_image_url: file_url });
    };

    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-1">סריקת צ׳ק</h3>
            <p className="text-slate-500 text-xs mb-4">
                צלם את הצ׳ק או העלה תמונה. המערכת תזהה אוטומטית את ח.פ של כותב הצ׳ק, סכום ותאריך פירעון.
            </p>

            {previewUrl && (
                <div className="mb-4 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                    <img src={previewUrl} alt="check preview" className="w-full max-h-48 object-contain" />
                </div>
            )}

            {phase === 'idle' && (
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <Button
                        onClick={() => fileRef.current?.click()}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold flex-1 h-11"
                    >
                        <Camera className="w-4 h-4 ml-2" />
                        צלם / בחר תמונה
                    </Button>
                </div>
            )}

            {(phase === 'uploading' || phase === 'extracting') && (
                <div className="flex items-center gap-3 text-slate-300 text-sm py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    {phase === 'uploading' ? 'מעלה תמונה...' : 'מזהה את נתוני הצ׳ק...'}
                </div>
            )}

            {phase === 'done' && (
                <div className="flex items-center gap-2 text-emerald-300 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    זוהה בהצלחה — בדוק את הפרטים למטה לפני שליחה.
                </div>
            )}

            {phase === 'error' && (
                <div className="flex items-center gap-2 text-rose-300 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
}