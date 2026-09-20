const tokenUrl = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
tokenUrl.search = new URLSearchParams({ corpid: "invalid", corpsecret: "invalid" });

const tokenResponse = await fetch(tokenUrl);
const tokenBody = await tokenResponse.json();
const corsResponse = await fetch("https://qyapi.weixin.qq.com/cgi-bin/wedrive/file_list?access_token=invalid", {
  method: "OPTIONS",
  headers: {
    Origin: "https://example.com",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type"
  }
});

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  apiReachable: tokenResponse.ok && Number(tokenBody.errcode) === 40013,
  tokenHttpStatus: tokenResponse.status,
  tokenErrorCode: tokenBody.errcode,
  tokenAllowsBrowserOrigin: tokenResponse.headers.has("access-control-allow-origin"),
  corsPreflightStatus: corsResponse.status,
  corsAllowsBrowserOrigin: corsResponse.headers.has("access-control-allow-origin")
}, null, 2));
