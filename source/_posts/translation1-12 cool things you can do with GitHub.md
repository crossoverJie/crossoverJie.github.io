---
title: 【译】你可以用GitHub做的12件 Cool 事情
date: 2017/11/5 01:01:54       
categories: 
- 翻译
tags: 
- GitHub
---

![](https://i.loli.net/2019/05/08/5cd1ba387b5a8.jpg)

### [原文链接](https://hackernoon.com/12-cool-things-you-can-do-with-github-f3e0424cf2f0)

## 1 在 GitHub.com 编辑代码

我将从我认为大家都知道的一件事情开始(尽管我是直到一周前才知道)。

当你在 GitHub 查看文件时(任何文本文件，任何仓库中)，右上角会有一个小铅笔图标，点击它就可以编辑文件了。完成之后点击 **Propose file change** 按钮 GitHub 将会自动帮你 fork 该项目并且创建一个 `pull request` 。

很厉害吧！他自动帮你 `fork` 了该 repo。

不再需要 `fork` , `pull` ,本地编辑再 `push` 以及创建一个 `PR` 这样的流程了。
![](https://i.loli.net/2019/05/08/5cd1ba3b3e25e.jpg)

这非常适合修复编写代码中出现的拼写错误和修正一个不太理想的想法。

## 2 粘贴图片

你不仅仅受限于输入文本和描述问题，你知道你可以直接从粘贴板中粘贴图片吗？当你粘贴时，你会看到图片已经被上传了(毫无疑问被上传到云端)之后会变成 `Markdown` 语法来显示图片。


## 3 格式化代码
如果你想写一段代码，你可以三个反引号开始 —— 就像你在[研究`MarkDown`](https://guides.github.com/features/mastering-markdown/)时所学到的 —— 之后 GitHub 会试着猜测你写的语言。

但如果你写了一些类似于 Vue, Typescript, JSX 这样的语言，你可以明确指定得到正确的高亮。

注意第一行中的
```
```jsx
```

![](https://i.loli.net/2019/05/08/5cd1ba3eac6e5.jpg)

<!--more-->

这意味着代码段将会呈现出:

![](https://i.loli.net/2019/05/08/5cd1ba43b2edd.jpg)

(这个扩展于 `gists` 。顺便说一句，如果你使用 `.jsx` 后缀，就会得到JSX的语法高亮)

这是一个所有受支持的[语法列表](https://github.com/github/linguist/blob/fc1404985abb95d5bc33a0eba518724f1c3c252e/vendor/README.md)。

## 4 在 PR 中用关键词关闭 Issues

假设你创建了一个用于修复 `Issues #234` 的 PR ,你可以在你 PR 的描述中填写 `fixes #234` (或是在你 PR 任意评论中填写都是可以的)。
之后合并这个 `PR` 时将会自动关闭填写的 `Issues`。怎么样,很 cool 吧。

了解是更多相关的[内容](https://help.github.com/articles/closing-issues-using-keywords/)。

## 5 链接到评论
你是否有过想要链接到特殊 `comment ` 的想法但却无法实现？那是因为你不知道怎么做。朋友那都是过去式了，现在我就告诉你，点击用户名旁边的日期/时间即可链接到该 `comment ` 。

![](https://i.loli.net/2019/05/08/5cd1ba48b96bc.jpg)

## 6 链接到代码

我知道你想链接到具体的代码行上。

尝试:查看文件时，点击代码旁边的行号。

看到了吧，浏览器的 `URL` 已经被更新为行号了。如果你按住 `shift`,同时点击其他行号，`URL` 再次被更新，并且你也高亮显示页面中的一段代码。

分享这个 URL ，访问时将会链接到该文件已经选中的那些代码段。

但等一下，那指向的是当前的分支，如果文件发生了改变呢？也许一个在当前状态连接到文件的永久连接正是你想要的。

我很懒，所以用一张截图展示以上的所有操作。

![](https://i.loli.net/2019/05/08/5cd1ba54a2c40.jpg)

谈到网址。。。

## 7 像命令行一样使用 GitHub 链接
使用 GitHub 自带的 UI 浏览也还不错，但有时直接在 URL 中输入是最快的方法。比如，我想跳转到我正在编辑的分支并和 `master` 进行对比，就可以在项目名称后面接上 `/compare/branch-name` 。

与选中分支的对比页将会显示出来:
![](https://i.loli.net/2019/05/08/5cd1ba58ca3f5.jpg)

以上就是和 master 分支的差异，如果想要合并分支的话，只需要输入 `/compare/integration-branch...my-branch
` 即可。

![](https://i.loli.net/2019/05/08/5cd1ba5c3e3e1.jpg)

你还可以利用快捷键达到同样的效果，使用 `ctrl + L` 或者 `cmd + L` 可以将光标移动到 `URL` 上(至少在 Chrome 中可以)。 加上浏览器的自动补全 —— 你就可以在两个分支之间轻松切换了。


## 8 在Issues创建列表

你想在你的 issue 中看到复选框列表吗?

![](https://i.loli.net/2019/05/08/5cd1ba5e4f661.jpg)

你想在查看 issue 列表是它们以好看的 `2 of 5` 进度条呈现吗？

![](https://i.loli.net/2019/05/08/5cd1ba612afad.jpg)


太好了！你可以用以下语法来创建一个交互性的复选框:

```
 - [ ] Screen width (integer)
 - [x] Service worker support
 - [x] Fetch support
 - [ ] CSS flexbox support
 - [ ] Custom elements
```

是由一个空格、中横线、空格、左括号、空格(或者是 X )、右括号、空格以及一些文本组成。

你甚至可以真正的 选中/取消 这些复选框！基于某些原因，对于我来说你看起来像是技术魔力。是真的能够选中这些复选框！甚至它还更新了底层源码。

> ps：以下包括第九点 基于GitHub的项目面板 由于用的不多就没有翻译。

## 10 GitHub wiki

作为一个像维基百科那样的非结构化的页面集合， `GitHub Wiki`的供给(我把它称之为 `Gwiki` ) 是一个非常棒的功能。

对于结构化的页面来说 —— 例如你的文档：不能说这个页面是其他页面的子页面，或则是有 “下一节”，“上一节” 这样的便捷按钮。并且 `Hansel` 和 `Gretel` 也没有，因为结构化页面并没有 `breadcrumbs` 这样的设计。

我们继续，让 Gwiki 动起来，我从 `NodeJS` 的文档中复制了几页来作为 wiki 页面。然后创建了一个自定义侧边栏，帮助我更好地模拟一些实际的目录结构。尽管它不会突出显示你当前的页面位置，但侧边栏会一直存在。

这些链接需要你手动维护，但总的来说，我认为它可以做得很好。 如果需要的话可以[看看](https://github.com/davidgilbertson/about-github/wiki)。

![](https://i.loli.net/2019/05/08/5cd1ba6b987b2.jpg)

虽然它与 `GitBook` ( [Redux 文档](http://redux.js.org/)所使用的)或者是定制网站相比仍有差距。但在你的 repo 中它有 80% 完全值得信赖的。

我的建议是: 如果你已经有多个 `README.md` 文件，并且想要一些关于用户指南或更详细的文档的不同的页面，那么你应该选择 `Gwiki`。

如果缺乏结构化/导航开始让你不爽的话，那就试试其他的吧。

## 11 GitHub Pages
你可能已经知道使用 `GitHub Pages` 来托管一个静态网站。如果你不知道，现在就来学习，这一节是专门用于讨论使用 `Jekyll` 来构建一个站点的。

最简单的就是： `GitHub Pages + Jekyll `会通过一个漂亮的主题来渲染你的 `README.md` 文件。例如:通过 [about-github](https://github.com/davidgilbertson/about-github)  来查看的我的 `README` 页面。

![](https://i.loli.net/2019/05/08/5cd1baf4dafe3.jpg)

如果我在 GitHub 中点击了 `settings`选项，切换到 `Github Pages` 设置，然后选择一个 `Jekyll theme`。。。

![](https://i.loli.net/2019/05/08/5cd1baf78ddf9.jpg)

我就可以得到 [Jekyll-themed 页面](https://davidgilbertson.github.io/about-github/)。

![](https://i.loli.net/2019/05/08/5cd1bafb61827.jpg)

从这点上我可以主要依据易编辑的 `Markdown` 文件来构建一个完整的静态站点。本质上是把 GitHub 变成了 `CMS`。

虽然我没有实际使用过，但是 `React Bootstrap` 的网站都是使用它来构建的。所以它不会糟糕。

注意:它要求 `Ruby` 运行本地环境( Windows 自行安装， macOS 自带)。



## 12 把 GitHub 当做 CRM 使用
假设你有一个存有一些文本内容的网站，你不想将文本内容存储于真正的 `HTML` 源码中。

相反的，你想要将这些文本块存储于非开发人员能轻松的进行编辑的地方。可能是一个版本控制系统，甚至是一个审核流程。

我的建议是:使用 GitHub 厂库中的 Markdown 文件来存储这些文本内容，然后使用前端组件来拉取这些文本块并展示在页面上。

我是搞 `React` 的，所以这有一个 解析 `Markdown` 的组件例子，给定一些 `Markdown` 文件路径，它将会自动拉取并作为 `HTML` 显示出来。

```react
class Markdown extends React.Component {
    constructor(props) {
      super(props);
      
      // replace with your URL, obviously
      this.baseUrl = 'https://raw.githubusercontent.com/davidgilbertson/about-github/master/text-snippets';
      
      this.state = {
        markdown: '',
      };
    }

    componentDidMount() {
      fetch(`${this.baseUrl}/${this.props.url}`)
        .then(response => response.text())
        .then((markdown) => {
          this.setState({markdown});
        });
    }

    render() {
      return (
        <div dangerouslySetInnerHTML={{__html: marked(this.state.markdown)}} />
      );
    }
}
```

### 奖励环节 —— GitHub 工具

我已经使用了 [Octotree Chrome extension](https://chrome.google.com/webstore/detail/octotree/bkhaagjahfmjljalopjnoealnfndnagc?hl=en-US) 有段时间了，现在我向大家推荐它！
无论你是在查看哪个 repo 它都会在左侧给你一个树状面板。

![](https://i.loli.net/2019/05/08/5cd1bafe8fb45.jpg)

通过这个[视频](https://www.youtube.com/watch?v=NhlzMcSyQek&index=2&list=PLNYkxOF6rcIB3ci6nwNyLYNU6RDOU3YyL)我了解到了 octobox，它是用于管理你的 `GitHub Issues` 收件箱，看起来相当不错！
以上就是我针对于`octobox`的全部想法。

## 其他
就是这样了！我希望这里至少有三件事是你还不知道的。

最后: hava a nice day！
