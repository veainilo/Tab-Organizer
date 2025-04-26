from PIL import Image, ImageDraw, ImageFont
import os

# 确保icons目录存在
if not os.path.exists('icons'):
    os.makedirs('icons')

# 定义图标尺寸
sizes = [16, 48, 128]

# 定义颜色
background_color = (0, 120, 215)  # Edge蓝色
tab_colors = [
    (255, 255, 255),  # 白色
    (230, 230, 230),  # 浅灰色
    (200, 200, 200),  # 灰色
]

for size in sizes:
    # 创建一个新的图像，带有透明背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 计算标签页的尺寸和位置
    padding = max(1, size // 16)
    tab_width = size - 2 * padding
    tab_height = max(2, size // 8)
    spacing = max(1, size // 32)
    
    # 绘制多个标签页（从下到上）
    for i, color in enumerate(tab_colors):
        y_offset = size - padding - (i + 1) * (tab_height + spacing)
        x_offset = padding + i * (size // 16)  # 每个标签页稍微错开
        
        # 绘制标签页
        draw.rectangle(
            [(x_offset, y_offset), (x_offset + tab_width, y_offset + tab_height)],
            fill=color,
            outline=background_color,
            width=max(1, size // 32)
        )
    
    # 绘制一个圆形，表示组织功能
    circle_radius = size // 4
    circle_x = size - circle_radius - padding
    circle_y = padding + circle_radius
    draw.ellipse(
        [(circle_x - circle_radius, circle_y - circle_radius), 
         (circle_x + circle_radius, circle_y + circle_radius)],
        fill=background_color
    )
    
    # 保存图像
    img.save(f'icons/icon{size}.png')
    print(f'Created icon{size}.png')

print('All icons generated successfully!')
