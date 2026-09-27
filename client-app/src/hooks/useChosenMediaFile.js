import { useState } from 'react';
import { needsPlaybackCheck, refusalForChosenFile } from '../services/mediaFile';

/**
 * The media file chosen for upload. A file this browser can't play is refused
 * as soon as it's chosen, with the reason passed to showError; while that check
 * runs, checkingFile is true so the upload can wait for it.
 */
export default function useChosenMediaFile(showError) {
    const [file, setFile] = useState(null);
    const [checkingFile, setCheckingFile] = useState(false);

    async function chooseFile(chosen) {
        showError('');
        setFile(chosen);
        if (!needsPlaybackCheck(chosen)) return;
        setCheckingFile(true);
        const refusal = await refusalForChosenFile(chosen);
        setCheckingFile(false);
        if (refusal) {
            setFile(null);
            showError(refusal);
        }
    }

    return { file, checkingFile, chooseFile, clearFile: () => setFile(null) };
}
