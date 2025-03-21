/*
 * 脚本名称：京东比价优化版（支持历史价格查询）
 * 使用说明：进入APP商品详情页面触发
 * 支持版本：App V15.0.80+
 * 脚本作者：小白脸（优化版）
 * 参考来源：[1](@ref)、[2](@ref)
*/

// 网络检测模块（引用自[1](@ref)的请求优化思路）
const checkNetwork = async () => {
  try {
    await this.$httpClient.head("https://www.jd.com", { timeout: 5000 });
    console.log("网络检测正常");
  } catch(error) {
    console.error("网络异常，请检查连接");
    $done({ body: "<h2>网络连接失败</h2>" });
  }
};

// 增强型HTTP请求模块（引用自[2](@ref)的油猴脚本实践）
const http = async (op) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while(retryCount < maxRetries) {
    try {
      const response = await this.$httpClient.get(op, {
        timeout: op.timeout || 120000, // 单次请求最大超时120秒
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'accept': 'application/json',
          'sec-fetch-site': 'same-site',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-dest': 'document',
          'connection': 'keep-alive'
        },
        followRedirects: true
      });

      if(response.statusCode >= 200 && response.statusCode < 300) {
        return JSON.parse(response.body);
      }
      
      console.log(`HTTP状态码 ${response.statusCode}，准备重试...`);
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, 2000 + retryCount*1000));
    } catch(error) {
      console.error(`请求失败：${error.message}`);
      retryCount++;
      if(retryCount >= maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 + retryCount*1000));
    }
  }
};

// 日期格式化工具（保持原有逻辑）
const toDate = (t) => {
  const d = new Date(t - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().split("T")[0];
};

// 价格处理工具（保持原有逻辑）
const parseNumber = (input) => {
  const cleaned = `${input}`.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
};

// 价格对比工具（保持原有逻辑）
const comparePrices = (a, b) => {
  const diff = formatNumber(parseNumber(a) - parseNumber(b));
  return diff > 0 ? `↑${diff}` : diff < 0 ? `↓${-diff}` : "●";
};

// 价格历史表格生成（保持原有逻辑）
const priceHistoryTable = (data) => { /* ...（保持表格生成逻辑不变） */ };

// 获取京东价格数据（增强错误处理）
const getPriceData = async () => {
  try {
    const itemId = $request.url.match(/\d+/)?.[0];
    if(!itemId) throw new Error("未找到商品ID");

    const response = await http({
      method: "post",
      url: "https://apapia-history.manmanbuy.com/ChromeWidgetServices/WidgetServices.ashx",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      body: JSON.stringify({
        methodName: "getHistoryTrend",
        p_url: `https://item.m.jd.com/product/${itemId}.html`,
        referer: $request.url
      })
    });

    return {
      groupName: "历史比价",
      atts: getJdData(response)
    };
  } catch(error) {
    console.error("获取价格数据失败：", error);
    return {
      groupName: "历史比价",
      atts: [{
        type: "error",
        date: new Date().toISOString(),
        price: "●",
        status: `请求失败 (${error.message})`
      }]
    };
  }
};

// 主执行逻辑
(async () => {
  await checkNetwork(); // 启动时检测网络
  const priceData = await getPriceData();
  let { body, headers } = $response;
  const tableHTML = priceHistoryTable(priceData);
  body = body.replace("<body>", `<body>${tableHTML}`);
  $done({ body, headers });
})();
