// First-open setup for the Unity project: makes the scene, adds it to the build, sets the app name and landscape screen.
// The game itself needs nothing in the scene: Game.cs starts itself (RuntimeInitializeOnLoadMethod) and draws everything in code.
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class NaadamySetup
{
    const string SCENE = "Assets/Scenes/Nutag.unity";

    static NaadamySetup() { EditorApplication.delayCall += () => { if (!File.Exists(SCENE)) Setup(); }; }

    [MenuItem("Naadamy/Set up project")]
    public static void Setup()
    {
        Directory.CreateDirectory("Assets/Scenes");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var cam = new GameObject("Main Camera").AddComponent<Camera>();
        cam.tag = "MainCamera"; cam.orthographic = true; cam.transform.position = new Vector3(0, 0, -10);
        EditorSceneManager.SaveScene(scene, SCENE);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(SCENE, true) };

        PlayerSettings.companyName = "Pinecone Academy";
        PlayerSettings.productName = "Naadamy";
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.pineconeacademy.naadamy");
        PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "com.pineconeacademy.naadamy");
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
        PlayerSettings.allowedAutorotateToPortrait = false;
        PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
        PlayerSettings.allowedAutorotateToLandscapeLeft = true;
        PlayerSettings.allowedAutorotateToLandscapeRight = true;
        PlayerSettings.defaultScreenWidth = 1280; PlayerSettings.defaultScreenHeight = 720;
        PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
        // Basar AI and playing together talk to "node server.js" on the local Wi-Fi over plain http/ws
        PlayerSettings.Android.forceInternetPermission = true;
        PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
        AssetDatabase.SaveAssets();
        Debug.Log("Naadamy: scene and build settings are ready. Press Play.");
    }

    [MenuItem("Naadamy/Build Android APK")]
    public static void BuildAndroid() => Build(BuildTarget.Android, "Builds/Android/Naadamy.apk");

    [MenuItem("Naadamy/Build Windows")]
    public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Naadamy.exe");

    /** The web build (Builds/WebGL), for a static host such as Vercel. From a terminal:
     *  Unity -batchmode -quit -projectPath NaadamyUnity -buildTarget WebGL -executeMethod NaadamySetup.BuildWebGL */
    [MenuItem("Naadamy/Build WebGL")]
    public static void BuildWebGL()
    {
        PlayerSettings.WebGL.template = "PROJECT:Naadamy";             // Assets/WebGLTemplates/Naadamy: the game fills the browser window
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip; // the host sends the .gz files with Content-Encoding: gzip (see vercel.json there)
        PlayerSettings.WebGL.decompressionFallback = false;
        PlayerSettings.WebGL.dataCaching = true;                       // a second visit starts without downloading the game again
        Build(BuildTarget.WebGL, "Builds/WebGL");
    }

    static void Build(BuildTarget target, string path)
    {
        if (!File.Exists(SCENE)) Setup();
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { SCENE }, locationPathName = path, target = target });
        Debug.Log($"Naadamy build {target}: {report.summary.result} → {path}");
        if (Application.isBatchMode && report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) EditorApplication.Exit(1); // a failed terminal build must not look like a success
    }
}
