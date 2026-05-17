import React, { useRef, useState } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

/**
 * Mobile-first check scanner.
 * - "צלם צ'ק" → opens the device rear camera directly (capture="environment")
 * - "העלה תמונה" → standard file picker (desktop or gallery)
 * Both flows upload to storage, run checkOcrExtract, and surface fields for confirmation.
 */
export default function CheckScanner({ onExtracted }) {
    const cameraRef = useRef(null);
    const uploadRef = useRef(null);
    const [phase, setPhase] = useState('idle'); // idle | uploading | extracting | done | error
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState('');

    const reset = () => {
        setPhase('idle');
        setPreviewUrl(null);
        setError('');
        if (cameraRef.current) cameraRef.current.value = '';
        if (uploadRef.current) uploadRef.current.value = '';
    };

    const handleFile = async (file) => {
        if (!file) return;
        setError('');
        setPreviewUrl(URL.createObjectURL(file));
        setPhase('uploading');

        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });

            setPhase('extracting');
            const res = await base44.functions.invoke('checkOcrExtract', { check_image_url: file_url });

            if (!res?.data?.success) {
                setPhase('error');
                setError(res?.data?.error || 'שגיאת זיהוי OCR');
                return;
            }

            setPhase('done');
            onExtracted?.({ ...res.data.extracted, check_image_url: file_url });
        } catch (e) {
            setPhase('error');
            setError(e.message || 'שגיאה בהעלאת הקובץ');
        }
    };

    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="text-white font-semibold mb-1">שלב 1 · סריקת צ׳ק</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">
                        צלם או העלה את הצ׳ק. המערכת תזהה אוטומטית את ח.פ של כותב הצ׳ק, סכום ותאריך פירעון —
                        ואז תחפש את צד ג׳ בהיסטוריית 12 החודשים שלך כדי לקבל החלטה.
                    </p>
                </div>
                {phase !== 'idle' && (
                    <Button variant="ghost" size="sm" onClick={reset} className="text-slate-400 hover:text-white text-xs h-7">
                        <RotateCcw className="w-3 h-3 ml-1" /> נקה
                    </Button>
                )}
            </div>

            {previewUrl && (
                <div className="mb-4 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                    <img src={previewUrl} alt="check preview" className="w-full max-h-56 object-contain" />
                </div>
            )}

            {phase === 'idle' && (
                <>
                    {/* Camera input — opens rear camera directly on mobile */}
                    <input
                        ref={cameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    {/* Plain upload — desktop / gallery */}
                    <input
                        ref={uploadRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            onClick={() => cameraRef.current?.click()}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold h-12"
                        >
                            <Camera className="w-4 h-4 ml-2" />
                            צלם צ׳ק
                        </Button>
                        <Button
                            onClick={() => uploadRef.current?.click()}
                            variant="outline"
                            className="bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700 h-12"
                        >
                            <Upload className="w-4 h-4 ml-2" />
                            העלה תמונה
                        </Button>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                        טיפ: צלם בתאורה טובה, ישר מלמעלה, כשהצ׳ק על רקע כהה — לזיהוי מיטבי של מספר הח.פ בתחתית.
                    </p>
                </>
            )}

            {(phase === 'uploading' || phase === 'extracting') && (
                <div className="flex items-center gap-3 text-slate-300 text-sm py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    {phase === 'uploading' ? 'מעלה תמונה...' : 'מזהה את נתוני הצ׳ק (OCR + AI)...'}
                </div>
            )}

            {phase === 'done' && (
                <div className="flex items-center gap-2 text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                    <CheckCircle2 className="w-4 h-4" />
                    זוהה בהצלחה — בדוק את הפרטים בצד וקבל החלטת חיתום.
                </div>
            )}

            {phase === 'error' && (
                <div className="flex items-center gap-2 text-rose-300 text-sm bg-rose-500/10 border border-rose-500/30 rounded p-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
}