---
title: Github commit 签名+合并 Commit
date: 2023/09/18 17:56:51
categories: 
- git
tags: 
- rebase
---
![Github的一个奇技淫巧.png](https://s2.loli.net/2023/09/18/gCjw9hZx4Y6cPSn.png)


# 背景

前段时间给 `VictoriaLogs` 提交了一个 PR：
[https://github.com/VictoriaMetrics/VictoriaMetrics/pull/4934](https://github.com/VictoriaMetrics/VictoriaMetrics/pull/4934)

本来一切都很顺利，只等合并了，但在临门一脚的时候社区维护人员问我可否给 `git` `commit` 加上签名。

> 于是我就默默的调试到了凌晨四点😭

![image.png](https://s2.loli.net/2023/09/18/VXhjU9ypuKP1ZWg.png)

<!--more-->
以前我也没怎么注意过这个选项，经过 `Google` 后发现 `Idea` 在提交的时候可以自行设置。

![image.png](https://s2.loli.net/2023/09/18/QdTetRSNG5c3KVr.png)
当我勾选了这个提交新的代码后，依然被告知没有正确的签名，这时我才发现理解错误了。

# 为 GitHub 的提交签名

结合这位社区大佬给的文档，他所需要的是每次提交的代码都是有签名的，类似于这样：
![image.png](https://s2.loli.net/2023/09/18/26vgVMZmNrPCkqo.png)

如果我们想要 `GitHub` 现实 `Verified` 这个标签，那就需要对 `commit` 或者是打的 `tag` 进行签名。

而签名的方式有三种：`GPG`, `SSH`, `S/MIME`，这里我以 GPG 签名为例，整体流程如下：

![image.png](https://s2.loli.net/2023/09/18/HwDIlL94c51Uz3e.png)

先在[https://www.gnupg.org/download/](https://www.gnupg.org/download/)这里下载安装 GPG 的命令行程序。

```shell
gpg --full-generate-key
```

使用这个命令生成 key，之后会根据提示录入一些信息，包含你的 ID 和邮箱，建议都和 GitHub 的 ID 邮箱保持一致即可，然后一路回车完事。

之后可以使用这个命令查看刚才创建的 Key：

```shell
gpg --list-secret-keys --keyid-format=long
------------------------------------
sec   4096R/3AA5C34371567BD2 2016-03-10 [expires: 2017-03-10]
uid                          Hubot <hubot@example.com>
ssb   4096R/4BB6D45482678BE3 2016-03-10
```

我们需要将 `3AA5C34371567BD2` 这个 Key 的 ID 字符串复制，之后执行：

```shell
gpg --armor --export 3AA5C34371567BD2
# Prints the GPG key ID, in ASCII armor format
```

此时会打印出公钥，我们将
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
-----END PGP PUBLIC KEY BLOCK-----
```
这些数据复制到 GitHub 的个人设置页面：
![image.png](https://s2.loli.net/2023/09/18/zvMgJcqAnRQjYxG.png)

此时还没完，如果我们直接提交代码的也不会有 `Verified` 的标签。

![image.png](https://s2.loli.net/2023/09/18/eST5f1Vad4x8Ou7.png)

我们还需要打开 git 的 config 设置：
```shell
git config commit.gpgsign true

# 全局打开
git config --global commit.gpgsign true
git commit -S -m "YOUR_COMMIT_MESSAGE"
git push
```

这样提交的 Commit 就会打上验证的标签了。
![image.png](https://s2.loli.net/2023/09/18/HKcvrfMozC9YEnx.png)

> -S 的效果和在 idea 中选中 Sign-off 的效果一样。

官方文档也有详细的步骤：
[https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)

# Squash 合并提交

不过在我这个 `PR` 的背景下还有一个步骤没有完成，就是我之前提交的 `Commit` 都没要验证，我需要将他们都合并为一个验证的 Commit 然后在强制推送上去，这样整个 `git log` 看起来才足够简洁。

最终效果如下，只有一个 Commit 存在。
![](https://s2.loli.net/2023/09/18/1OzjkDwhdWuJS8n.png)

这时候就得需要 git rebase 出马了。

![image.png](https://s2.loli.net/2023/09/18/vaOPw3gQTtVSoxC.png)
以刚才测试的这两个提交为例，我需要将他们合并为一个提交。

我们先使用这个命令：

```shell
git rebase -i HEAD~N
git rebase -i HEAD~2
```
N 就是我们需要合并几个提交，在我这里就是 2.

![image.png](https://s2.loli.net/2023/09/18/PN6nUE3BVu48TWF.png)
我们需要将除了第一个 commit 之外的都修改为 s，也就是下面注释里的 `squash` 的简写（压缩的意思）。

这是一个 vim 的交互编辑模式，编辑完成之后保存退出。
> 不会还有程序员不知道如何保存 vim 退出吧🐕。

保存后又会弹出一个编辑页面，让我们填写这次压缩之后的提交记录，默认会帮我生成好，当然你也可以全部删掉后重写。

![image.png](https://s2.loli.net/2023/09/18/YCx5ablcrBmsdiD.png)

我这里就直接使用它生成好的就可以了，依然还是保存退出。

最后再强行推送到我所在的分支即可：
```shell
git push origin test-rebase -f
```

在这个分支的提交页面也只会看到刚才强行推送的记录了，刚才的两个提交已经合并为这一个了。

![image.png](https://s2.loli.net/2023/09/18/ULO3kxgSYErPqle.png)


# 将修改提交到其他分支
有时候线上出现问题需要马上修复的时候，我会不下意识的直接就开始改了，等真的提交代码被拒的时候才发现是在主分支上。

我觉得有类似需求的场景还不少，这时候就需要将当前分支的修改提交到一个新的分支上，总不能 revert 之后重新再写吧。

所以通常我的流程是这样的：
```shell
# 新建一个分支
git branch newbranch

# 将当前分支的修改临时保存到暂缓区，同时回滚当前分支。
git stash

# 切换到新的分支
git checkout newbranch

# 从暂缓区中取出刚才的修改
git stash pop
```

这样之前分支的修改就会同步到新的分支上了，借着便在新的分支上继续开发了。

# 总结

借着这个机会也了解了 `rebase` 的骚操作挺多的，不过我平时用的最多的还是 `merge`，这个倒没有好坏之分，只要同组的开发者都达成一致即可。



#Blog #Github #Git