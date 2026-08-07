# MiniMax Vision 图像理解

使用 MiniMax 的 vision 能力来分析图片。

## 环境要求
- Python
- requests 库

## 使用方法

```python
import requests
import os

def understand_image(image_url, prompt="描述这张图片"):
    api_key = os.environ.get("MINIMAX_API_KEY")
    api_host = os.environ.get("MINIMAX_API_HOST", "https://api.minimaxi.com")
    
    url = f"{api_host}/v1/text/chatcompletion_pro"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "MiniMax-M2.5",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    }
    
    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# 使用示例
result = understand_image(
    image_url="https://example.com/image.jpg",
    prompt="这张图片里有什么？"
)
print(result)
```

## API Key
需要设置环境变量：
- `MINIMAX_API_KEY`: 你的 MiniMax API key
- `MINIMAX_API_HOST`: API 地址（国内用 https://api.minimaxi.com）
