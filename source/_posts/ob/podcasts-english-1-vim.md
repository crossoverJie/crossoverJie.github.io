---
title: 跟着播客学英语-Why I use vim ? part two.
date: 2023/10/06 20:54:10
categories:
  - OB
  - Podcasts
tags:
  - English
---
![](https://s2.loli.net/2023/10/05/lx4a2h1KcUyIoHd.png)

在上一期作者讲到了他使用 Vim 的主要原因是提高效率，不需要再去使用鼠标，今天我们继续上次未听完的内容：


<!--more-->
if you type Vi, that's going to be alias to Vim anyway by default there's, not really a good reason for you to use vi that I can think of. The reason I first started using Vim is kind of a `silly` one, and that is because my brother used it, uh, my brother, Nick, he climbs mountains for a living. Right now, he lives in Seattle and goes up and down rain near when it gets too cold to climb. Rainer? He goes to the other side of the world and leads, climbs up mountains over there, and then comes back again and starts climb a rain air over and over and over again.

Before he did that, though, he used to do quite a bit of programming, and I remember when I would watch him program because he started programming before me, he looked like a real hacker. He looked like the hackers you see on TV. He never touched the mouse. There was text flying out all over the screen files, opening, closing splits. It was awesome. It was like I wanted to be that person you. Know and He was using vim. I didn't know it was Vim, but that's what he was using. So I opened Vim. I tried to edit some files I was using Eclipse at the time and doing Java.

> 作者首次使用 Vim 的 原因有点傻，因为他的哥哥 Nick 做了很长时间的编程，一直使用的都是 Vim，看起来就行是电视里真正的黑客那样，他从不使用鼠标，文字也在屏幕里乱飞，看起来非常酷。
> 而那个时候作者还在使用 eclipse 编写 Java

This is like my first year of college, I was taking an introductory to programming class. It's the first programming I've ever done, and I thought Eclipse was great. It compiled my code for me. It had buttons for everything, but I didn't feel like a real hacker when I looked at nick. I mean, granted, he was writing C, which already looks way cooler. He was using Vim as well, and it just `impressed` me, so I try to start opening up some of my Java files, and I have no idea how to do it. No idea how to edit a file I have no idea how to save a file I have no idea how to type in the document for crying out loud.

If I press keys, it does nothing. Sometimes a delete words, sometimes at pacewords, `it's a mess`, and this is probably the first experience that everybody has when they start using Vim, because Vim operates completely different than any other text editor I've ever used it's `weird` them has modes, it has a language, it has objects, subjects, counts, verbs. All that stuff is, like, really weird when you first get started, but once you understand it, it's a lot of learning upfront everything, just kind of clicks and you're instantly faster than you've ever been before,

> eclipse 很好用，但看起来没有 Nick 使用 Vim 那么酷，使得作者印象深刻。
> 
> 因此他尝试使用 Vim 来打开 Java 文件，但却不知道如何编辑、删除、保存等基本操作，大部分初次使用 Vim 应该都会碰到这些问题，它和我们使用的其他编辑器完全不同，看起来比较奇怪。
> 
> 不过一旦你掌握它，那么使用效率将会飞速提高。


for example, let's say, we wanted to copy a method from one ruby file and put it in another. If I was using sublime text, I would take my mouse. I would select that method I'd press command c to copy it, and then I'd click over to where I want the method to be, and I'd press command v to paste it. Not very bad that's pretty fast probably doesn't take very long, but in Vim, you can do it even faster and without touching your mouse, them has a verb for yanking text it's not called copying it's, called yanking.

It has a movement called inside, so you can yank inside something, and then it has subjects called text blocks, which, in Ruby, those are methods. Vim understands blocks of text if you're editing a markdown document like, say, a read me, them'll know where a paragraph starts and where a paragraph ends, if we're editing a ruby file it's going to know where a method begins and where a method ends, or where your class begins or where your class ends, so using the Verb Yank, which happens to be the key Y,

> 如果我们使用 sublime 这样的编辑器复制一个方法时会比较麻烦，首先要用鼠标选中文本，然后复制再粘贴。
> 但使用 Vim 时不需要使用鼠标，而是被称为 Yanking，当编辑  Markdown 时 Vim 会知道段落的开始和结尾，编辑 Ruby 时可以方法的开始和结尾。

and then the movement inside, which happens to be the key I, and then the subject paragraph, which is vim's word for a block of text, you can yank a method. So if I put my cursor inside a ruby method and I type Y I P. For yank inside paragraph, it's going to copy that method to the clipboard. So by understanding the verb, yank the movement inside and the subject paragraph, we can perform actions really, really quickly, and then if we want to pace it somewhere else, we press the peaky for paste,

and it'll stick that text down, so everything in Vim is based on those concepts of verbs, movements and subjects. You also have one more thing you can play with, and that is counts, so if you want to perform something multiple times, in most cases, you can stick a number in front of it like one, two, three, five, and it's going to do it that many times, understanding those basic concepts, gets you a really long way, and then it's just a matter of understanding which keys correspond to which verbs and which movements and which subjects,

> 在 vim 中只需要将光标移动到方法中，然后使用 YIP 就可以复制整个方法。
> 所以只要理解了这些基本概念就可以快速提高效率。

and that just comes with time, which is the third reason I like to use Vim. Is there so much stuff to learn whenever I get bored? All I got to do is pull up them help, and I could start learning stuff in every little thing, I learn, every little keyboard shortcut, every movement, every subject, gets me a little bit faster, and it doesn't seem like a lot like the example I gave earlier, of copying and pasting text and sublime with a mouse that doesn't take very long. But if you add up all those little bits,

you're saving a ton of time, a good `analogy` I like to use is `lifting` weights if I'm `squatting` 100 pounds, and I take a little, teeny, tiny two and a half pound plate, and I put it on each side of the barbell I probably won't, even notice it, I mean, I'll be squatting 105 pounds now, right, that's not really that big of a difference, but if I add those two and a half pound plates 60 more times, going in once a day, and doing that, I'm now squatting 400 pounds, which is a pretty big difference, so those little changes don't seem like a lot,

> 我喜欢使用 Vim 的一个原因是可以学到许多东西，每学一些都可以让自己的效率提高一点。
> 就像是我们深蹲一样，慢慢的加重量，反复尝试最终就能得到巨大的提升。

but taken as a whole, you're editing text way faster than people who aren't using vim. The last reason I like to use Vim is because it runs in the terminal, and this may not seem like a big deal, but it really is `cosmetically`, it's nice because you can just pop a terminal open, full screen and have no chrome I use mac os, so I've got that big menu bar on top, it's really nice to just full screen a terminal and not see anything at all, and have your command line tools and your text editor all running in the same window I happen to use tmucks to manage that stuff I won't talk about Tmux and now,

but I definitely will talk about it in another episode, but even out of the `cosmetic` reasons, it's nice to have a text editor that runs in the terminal because you're not always using your own machine right as web developers, I'm a web developer, we're always connecting to remote machines to edit files. Now, why is it that we should be forced to use a different text editor? The nice thing about Vim is it runs in the terminal, so every machine you connect to will likely already have Vim installed, but even if it doesn't you can install it,

and you can put your config files over there and you can make it so that no matter where you're editing text you're always in the same environment, which is awesome. Before I started using Vim out, connect a remote machines, and, and be forced to use some textset or I'm not familiar with, and it drove me nuts, but now I sometimes forget I'm on a remote machine because it's exactly the same as the machine I use at home, so if you've never tried them, or maybe you tried it in the past, and it was super confusing or really turned you off.

> 最后一个使用 Vim 的 原因是它可以在终端中运行，不仅可以使用自己的设备，还可以连接到远程设备去编辑文件，还可以使用相同的配置文件，使得所有的环境配置都是相同的

Give it a second shot there's, a great stack overflow article that just kind of rehashs a lot of the things I said here, but it's just it's also just fun to read it talks about the core concepts of vi, the editor that Vim is based on, and I put a link to that in the shownotes there's, also, them casts by Drew Neil, which is a screencast series that's totally free, and he covers a lot of advanced concepts he's got a little bit of beginner stuff in there as well. You can also just open up a terminal and type vim tutor and Vim's going to give you a little lesson in how to use Vim,

give it a shot that's all I've got for this week, you can find the shownotes at healthy hacker Dot Com, slash one, if you have any questions or feedback, send me a voicemail healthy hacker, Dot Com Slash Voicemail.

> 在 stack overflow 中有着各种教程，大家可以尝试一下。

# 生词

The reason I first started using Vim is kind of a `silly` one
我第一次使用 Vim 的原因有点傻。

![image.png](https://s2.loli.net/2023/10/06/WKxpPUNT5wZr983.png)
----

`it's a mess`
搞砸了
![image.png](https://s2.loli.net/2023/10/06/Cl6pKGR7e8A54mk.png)

a good `analogy` I like to use is `lifting` weights if I'm `squatting` 100 pounds,
but it really is `cosmetically`,
![](https://s2.loli.net/2023/10/06/8DxnNGwmMiyzCbJ.png)


![image.png](https://s2.loli.net/2023/10/06/68yEronuJUpm9wW.png)
![](https://s2.loli.net/2023/10/06/2O86HijZufx9eVW.png)
