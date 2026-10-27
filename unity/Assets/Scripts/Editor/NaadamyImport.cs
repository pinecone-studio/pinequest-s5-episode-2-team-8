// Import settings for the files the game loads at runtime: music streams from disk instead of filling memory.
using UnityEditor;

public sealed class NaadamyImport : AssetPostprocessor
{
    void OnPreprocessAudio()
    {
        if (!assetPath.Contains("/Resources/Music/")) return;
        var imp = (AudioImporter)assetImporter;
        var s = imp.defaultSampleSettings; s.loadType = UnityEngine.AudioClipLoadType.Streaming; s.compressionFormat = UnityEngine.AudioCompressionFormat.Vorbis; s.quality = 0.4f;
        imp.defaultSampleSettings = s; imp.loadInBackground = true;
    }
}
