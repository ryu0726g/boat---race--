export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*"};
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ok:true,service:"boatrace-ai-worker"}),{headers});
    }
    if (url.pathname.startsWith("/api/race/")) {
      return new Response(JSON.stringify({ok:false,message:"公式データ取得アダプタは次フェーズで実装"}),{status:501,headers});
    }
    return new Response(JSON.stringify({ok:false,message:"not found"}),{status:404,headers});
  }
};
