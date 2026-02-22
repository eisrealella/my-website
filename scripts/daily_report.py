#!/usr/bin/env python3
"""海粼酱工作日报生成器 - 剪贴板版"""

import subprocess
import sys
from datetime import datetime, timedelta

def get_date_str():
    """获取日期字符串"""
    if len(sys.argv) > 1 and sys.argv[1] == 'yesterday':
        date = datetime.now() - timedelta(days=1)
    else:
        date = datetime.now()
    return date.strftime('%Y-%m-%d')

def get_weekday(date):
    weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return weekdays[date.weekday()]

def generate_content(date_str, is_morning=False):
    """生成日报内容"""
    
    greeting = "晚间总结" if not is_morning else "早间总结"
    
    content = f"""═══════════════════════════════════
        {date_str} 海粼酱工作日报
═══════════════════════════════════

📋 每日概览

   日期  |  {date_str}
   星期  |  {get_weekday(datetime.now())}
   时间  |  {greeting}

✅ 今日完成

   🎯 主要任务
      • 工作任务1
      • 工作任务2
      • 工作任务3

   🎯 优化改进
      • 持续优化工作流程
      • 学习新技术/工具

📝 明日计划

   ○ 明日任务1
   ○ 明日任务2
   ○ 明日任务3

💡 今日感悟

   每天总结，每天进步！✨

🐱 每天进步一点点"""
    
    return content

def copy_to_clipboard(content):
    """复制到剪贴板"""
    subprocess.run(['pbcopy'], input=content.encode('utf-8'))
    print("✅ 日报已复制到剪贴板！")
    print("请打开备忘录，Command+V 粘贴～")

def main():
    is_morning = len(sys.argv) > 1 and sys.argv[1] == 'morning'
    date_str = get_date_str()
    
    content = generate_content(date_str, is_morning)
    copy_to_clipboard(content)

if __name__ == '__main__':
    main()
