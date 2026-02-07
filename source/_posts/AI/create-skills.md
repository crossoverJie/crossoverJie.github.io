---
title: 一行代码没写，用 AI 搓出三个实用 SKILLS
date: 2026/02/07 17:56:51
categories:
  - AI
tags:
  - AI
  - Skills
  - Claude
banner_img: https://s2.loli.net/2026/02/07/6PswKrdLI5Jmc3f.png
index_img: https://s2.loli.net/2026/02/07/6PswKrdLI5Jmc3f.png
---
# 背景

最近上一篇文章里答应过要分享下我那三个 [SKILLS](https://github.com/crossoverJie/skills) 的创建过程，乘热打铁赶紧写出来。

上篇提到过我写博客的一个痛点：每次写完文章都要手动找封面图 → 上传图床 → 粘贴链接，这套流程走下来虽然不复杂，但每次都要做一遍确实烦。

所以我就想着把这个流程自动化掉，而且全程一行代码没写，完全和 AI 对话搞定。

<!--more-->

# Skills 介绍

先整体介绍一下最终产出的三个 SKILLS：

| Skill 名称 | 用途 | 关键特性 |
|-----------|------|---------|
| image-uploader | 上传图片到图床 | 支持 sm.ms，抽象基类方便扩展，多来源 token 配置 |
| cover-generator | 生成渐变封面图 | 基于 Pillow，4 种主题，支持中文，可选自动上传 |
| auto-blog-cover | 端到端博客配图 | 解析 Markdown → 提取标题 → 生成封面 → 上传 → 更新 frontmatter |

三个 SKILLS 之间存在依赖关系：

```
auto-blog-cover → cover-generator → image-uploader
```

`auto-blog-cover` 是最上层的入口，调用 `cover-generator` 生成图片，`cover-generator` 再调用 `image-uploader` 上传到图床。最终我只需要跑一条命令，整个流程就搞定了。

> 这里分成三个 skill 的好处是：更好的分层可以帮助其他用户选择合适自己的 skill，比如有些人可能只需要一个上传图片的 skill 而已。

计算机经典架构之一：遇事不决先分层😊。
## [image-uploader](https://github.com/crossoverJie/skills/tree/main/skills/image-uploader)

这是最底层的基础 SKILL，负责把本地图片上传到图床，目前支持 `sm.ms`。

设计上用了抽象基类 `BaseUploader`，后期想接入腾讯云、阿里云这些只需要新增一个实现类就行：

```python
class BaseUploader(ABC):
    @abstractmethod
    def upload(self, image_path):
        pass

class SmMsUploader(BaseUploader):
    API_URL = "https://sm.ms/api/v2/upload"
    # ...
```

token 配置支持三种方式，优先级从高到低：

1. 命令行参数 `--token`
2. 环境变量 `SMMS_TOKEN`
3. 配置文件 `config.json`

> 这个优先级设计是在对话中讨论出来的，一开始只有命令行参数，后来考虑到分享给其他人使用的场景才加上了环境变量和配置文件。

## [cover-generator](https://github.com/crossoverJie/skills/tree/main/skills/cover-generator)

这个 SKILL 用 Pillow 生成渐变风格的封面图（1200x630），支持四种主题：

| 主题 | 效果 |
|-----|------|
| random | 随机渐变色 |
| dark | 深色系 |
| light | 浅色系 |
| blue | 蓝紫渐变 |

核心就是生成一个渐变背景，然后把标题和副标题居中渲染上去。加了 `--upload` 参数可以生成后直接调用 `image-uploader` 上传。

上传完成后会自动清理本地临时文件，上传失败还会自动重试最多 3 次。

## [auto-blog-cover](https://github.com/crossoverJie/skills/tree/main/skills/auto-blog-cover)

这是最终面向用户的 SKILL，把整个工作流串起来：

1. 读取 Markdown 文件，解析 frontmatter
2. 提取标题（支持手动传入覆盖）
3. 调用 `cover-generator` 生成封面并上传
4. 用正则替换更新 frontmatter 中的 `banner_img` 和 `index_img`

> 这里用正则替换而不是直接用 `python-frontmatter` 库回写，是因为后者会重排 YAML 字段的顺序，导致我博客的 frontmatter 格式被打乱。

使用起来很简单：

```bash
# 全自动模式
python3 skills/auto-blog-cover/auto_blog_cover.py /path/to/blog.md

# 手动指定标题
python3 skills/auto-blog-cover/auto_blog_cover.py blog.md --title "AI Evolution" --subtitle "From Function Call to MCP"
```

# 创建过程

整个创建过程就是和 AI 不断对话、迭代出来的，下面分阶段回顾下。

## 阶段一：从 image-uploader 开始

一开始我的需求很简单：我需要一个上传图片到 sm.ms 的工具。

我给 AI 提供了 sm.ms 的[接口文档](https://doc.sm.ms/#api-Image-Upload)，然后让它帮我实现。AI 先问了我几个问题：用什么语言？做成什么形式？我选了 Python 脚本 + 独立 CLI 工具。

然后就是一个很有意思的讨论——token 怎么传递。

AI 一开始的方案是通过命令行参数传入：
```bash
python skills/image_uploader.py image.png --token YOUR_TOKEN
```

我提了一个问题："token 如果从命令行中获取是否方便其他人使用这个 SKILLS？"

这一下就打开了思路，于是补充了环境变量和配置文件两种方式，形成了三级优先级的配置体系。

跑起来测试的时候，AI 直接从我的 `.zshrc` 里找到了 `SMMS_TOKEN` 环境变量（之前配好的），上传了一张壁纸验证通过。

## 阶段二：cover-generator 的诞生

接着我提了第二个需求：我想给博客文章生成封面图。

这里我不想直接调用类似于  `Nano Banana` 这里的专门文生图模型，就只需要一个简单背景+文字的图片即可；

所以 AI 给了我一个方案：算法生成艺术图 vs 文字+背景，本地用 Pillow 就能生成。

生成的图片效果还不错，简洁的渐变背景加上标题文字，虽然比不上专业设计，但作为博客封面还是够用了。

后来我又提了几个优化：
- 图片生成后要自动清理本地文件（不占存储）
- 上传失败要能重试

AI 都逐一实现了，加了 retry 逻辑和 `finally` 块里的清理代码。

## 阶段三：auto-blog-cover 串联一切

前两个 SKILLS 搞定后，我描述了一下我的实际工作流：

> 我会在 Obsidian 里写博客，写完之后打开 CLI，让它读取博客内容，调用 cover-generator 生成封面并上传，然后把图片地址更新到博客的 frontmatter 里。

AI 认为这个流程完全可以自动化，建议我再创建一个 SKILL 来串联。我觉得很有道理，一个独立的 SKILL 也方便其他有类似需求的人使用。

这中间有两个值得一提的坑：

**中文乱码问题**：第一次跑 auto-blog-cover 时，生成的封面图里中文全是乱码。原因是 Pillow 默认字体不支持中文。AI 把字体改成了 `STHeiti Light`（macOS 系统自带的中文字体），同时加了 Linux 和 Windows 的字体回退列表。

**YAML 字段排序问题**：一开始用 `python-frontmatter` 库回写文件时，它会把我的 YAML 字段重新排序。比如原来是 `title → date → categories → tags → banner_img`，回写后变成了按字母排序的 `banner_img → categories → date → ...`。AI 改用正则表达式直接替换字段值，这样就不会动其他字段的顺序了。

修复这两个问题后再跑了一次，效果完美——中文正常显示，frontmatter 格式完好。

## 迭代的节奏

回顾整个过程，基本上就是这样一个循环：

```
提需求 → AI 实现 → 我测试 → 发现问题 → AI 修复 → 再测试
```

每一轮对话都在不断完善功能、补全边界情况。从最初的单个上传脚本，逐步演化出三个分层的 SKILLS，整个过程非常自然。

# 总结

这次体验下来，最大的感受是：**把重复性的工作流固化成 SKILLS 真的很香**。

以前每次写完博客要手动配图、上传、粘贴链接，虽然每次也就几分钟，但积少成多也挺烦的。现在一条命令搞定，而且整个创建过程我确实一行代码没写，全程和 AI 对话完成。

对话式开发的好处在于：你不需要事先想好所有细节，可以边做边想、边测边改。像 token 配置方案、中文字体、YAML 排序这些问题，都是在实际使用中发现并解决的。

感兴趣的可以去 [GitHub 仓库](https://github.com/crossoverJie/skills) 看看源码，也欢迎提 issue 和 PR。

#Blog
