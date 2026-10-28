// The isometric pixel pictures (buildings, Basar: Bodies.Paint) standing facing the camera. Each pixel writes its own depth,
// kept beside the picture in _DepthTex (how much farther than the picture's plane that pixel's surface is, 16-bit in r and
// g over -8..8 tiles), so people, trees and fences go in front of and behind every part of a building correctly
// instead of the whole picture sitting at one depth.
Shader "Naadamy/Picture"
{
    Properties { _MainTex ("Picture", 2D) = "white" {} _DepthTex ("Depth", 2D) = "black" {} }
    SubShader
    {
        Tags { "Queue" = "AlphaTest" "RenderType" = "TransparentCutout" "IgnoreProjector" = "True" }
        Cull Off ZWrite On ZTest LEqual
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"
            sampler2D _MainTex, _DepthTex;
            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float3 view : TEXCOORD1; };
            v2f vert (appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.view = UnityObjectToViewPos(v.vertex); o.uv = v.uv; return o; }
            fixed4 frag (v2f i, out float depth : SV_Depth) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv);
                clip(c.a - 0.5);
                float4 e = tex2D(_DepthTex, i.uv);
                float off = (e.r * 255 * 256 + e.g * 255) / 65535 * 16 - 8;
                float3 v = i.view; v.z -= off; // view space looks down -z, so farther is more negative
                float4 cp = mul(UNITY_MATRIX_P, float4(v, 1));
                float d = cp.z / cp.w;
                #if defined(SHADER_API_GLES) || defined(SHADER_API_GLES3) || defined(SHADER_API_GLCORE) || defined(SHADER_API_WEBGL)
                d = d * 0.5 + 0.5; // OpenGL's depth runs -1..1 before the window's 0..1
                #endif
                depth = d;
                return fixed4(c.rgb, 1);
            }
            ENDCG
        }
    }
}
