// The game's pixel font (Resources/Fonts/NaadamyPixel.ttf, Tiny5 like the web version) is drawn as hard pixels, not smoothed.
using UnityEditor;
using UnityEngine;

class NaadamyFontImport : AssetPostprocessor
{
    void OnPreprocessAsset()
    {
        if (!(assetImporter is TrueTypeFontImporter f) || !assetPath.EndsWith("NaadamyPixel.ttf")) return;
        f.fontRenderingMode = FontRenderingMode.HintedRaster; // no anti-aliasing: every font pixel is a crisp square
        f.fontTextureCase = FontTextureCase.Dynamic;
        f.includeFontData = true;                           // a browser has no system fonts to fall back on
    }
}
