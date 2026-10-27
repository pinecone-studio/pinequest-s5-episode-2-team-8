// The game's fonts (Resources/Fonts), as on the web version: Tiny5 for labels, drawn as hard pixels; Nunito for text and
// Rubik for headings, drawn smooth so longer text is easy to read.
using UnityEditor;
using UnityEngine;

class NaadamyFontImport : AssetPostprocessor
{
    void OnPreprocessAsset()
    {
        if (!(assetImporter is TrueTypeFontImporter f) || !assetPath.Contains("/Resources/Fonts/")) return;
        bool pixel = assetPath.EndsWith("NaadamyPixel.ttf");
        f.fontRenderingMode = pixel ? FontRenderingMode.HintedRaster : FontRenderingMode.Smooth; // pixel letters: every font pixel a crisp square
        f.fontTextureCase = FontTextureCase.Dynamic;
        f.includeFontData = true;                                                                   // a browser has no system fonts to fall back on
    }
}
