// Water and clouds in the 3D world: see-through (_Alpha), drawn after the land without writing depth.
// _Fog 0 turns the fog off (clouds float far away and would otherwise vanish into it).
Shader "Naadamy/VoxelClear"
{
    Properties { _MainTex ("Texture", 2D) = "white" {} _Alpha ("Alpha", Float) = 0.78 _Fog ("Fog", Float) = 1 }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        Cull Off ZWrite Off Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            sampler2D _MainTex; float _Alpha, _Fog;
            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; UNITY_FOG_COORDS(1) };
            v2f vert (appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv; o.color = v.color; UNITY_TRANSFER_FOG(o, o.pos); return o; }
            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 c = tex2D(_MainTex, i.uv);
                clip(c.a - 0.5);
                c.rgb *= i.color.rgb;
                fixed4 f = c; UNITY_APPLY_FOG(i.fogCoord, f);
                c.rgb = lerp(c.rgb, f.rgb, _Fog); c.a = _Alpha;
                return c;
            }
            ENDCG
        }
    }
}
