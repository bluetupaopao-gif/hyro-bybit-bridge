javascript
import express from "express"
import crypto from "crypto"

const app = express()
app.use(express.json())

app.get("/", (req, res) => {
  res.send("Bridge is running")
})

app.post("/webhook", async (req, res) => {
  try {
    const alert = req.body

    if (!alert || !alert.symbol || !alert.side || !alert.qty) {
      return res.status(400).json({ error: "invalid payload", received: alert })
    }

    const apiKey = process.env.BYBIT_DEMO_API_KEY
    const apiSecret = process.env.BYBIT_DEMO_API_SECRET
    const baseUrl = "https://api-demo.bybit.com"
    const recvWindow = "5000"
    const timestamp = Date.now().toString()

    const orderBody = {
      category: "linear",
      symbol: alert.symbol,
      side: alert.side,
      orderType: "Market",
      qty: String(alert.qty),
      timeInForce: "IOC",
      reduceOnly: false,
      positionIdx: 0,
    }

    if (alert.stopLoss) {
      orderBody.stopLoss = String(alert.stopLoss)
      orderBody.slOrderType = "Market"
    }
    if (alert.takeProfit) {
      orderBody.takeProfit = String(alert.takeProfit)
      orderBody.tpOrderType = "Market"
    }
    if (alert.stopLoss || alert.takeProfit) {
      orderBody.tpslMode = "Full"
    }

    const bodyStr = JSON.stringify(orderBody)
    const signStr = timestamp + apiKey + recvWindow + bodyStr
    const signature = crypto.createHmac("sha256", apiSecret).update(signStr).digest("hex")

    const resp = await fetch(`${baseUrl}/v5/order/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recvWindow,
      },
      body: bodyStr,
    })

    const rawText = await resp.text()
    console.log("Bybit原始响应内容:", rawText)

    let result
    try {
      result = JSON.parse(rawText)
    } catch (e) {
      console.log("解析失败，原始内容：", rawText)
      return res.status(502).json({ error: "invalid response from Bybit", raw: rawText })
    }

    console.log("下单请求:", orderBody)
    console.log("Bybit响应:", result)

    if (result.retCode !== 0) {
      console.log("警告：Bybit返回非成功状态，retMsg:", result.retMsg)
    }

    res.json(result)
  } catch (err) {
    console.error("处理请求时出错:", err)
    res.status(500).json({ error: String(err) })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Bridge server listening on port ${PORT}`)
})
