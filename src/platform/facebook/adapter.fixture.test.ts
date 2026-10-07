import { Window } from 'happy-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { facebookAdapter } from './adapter'

function installDom(html: string, url = 'https://www.facebook.com/'): Window {
  const win = new Window({ url })
  win.document.write(html)
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    HTMLElement: win.HTMLElement,
    Element: win.Element,
    InputEvent: win.InputEvent,
  })
  return win
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
  Reflect.deleteProperty(globalThis, 'Element')
  Reflect.deleteProperty(globalThis, 'InputEvent')
})

describe('facebook adapter fixture integration', () => {
  it('detects a verified account context and scans visible articles', () => {
    installDom(`
      <nav role="navigation">
        <a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a>
      </nav>
      <main>
        <div role="article">
          <strong>Trần Minh</strong>
          <p>Đây là một bài viết đủ dài về AI automation và cách tách phần suy luận khỏi phần thực thi để hệ thống dễ kiểm soát hơn trong môi trường sản xuất.</p>
          <a href="https://www.facebook.com/example/posts/456">2 giờ</a>
        </div>
      </main>
    `)

    const context = facebookAdapter.getContext()
    expect(context.surface).toBe('FEED')
    expect(context.account?.verified).toBe(true)
    expect(context.account?.label).toBe('Nguyễn Văn A')

    const posts = facebookAdapter.scan(10)
    expect(posts).toHaveLength(1)
    expect(posts[0].accountContextKey).toBe(context.account?.key)
    expect(posts[0].accountLabel).toBe('Nguyễn Văn A')
    expect(posts[0].surface).toBe('FEED')
    expect(posts[0].permalink).toContain('/posts/456')

    const diagnostic = facebookAdapter.diagnose()
    expect(diagnostic.health).toBe('HEALTHY')
    expect(diagnostic.articleCount).toBeGreaterThan(0)
    expect(diagnostic.accountEvidenceCount).toBeGreaterThan(0)
  })

  it('prepares approved text inside a fixture composer without submitting it', async () => {
    const win = installDom(`
      <nav role="navigation">
        <a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a>
      </nav>
      <div role="article">
        <strong>Trần Minh</strong>
        <p>Đây là một bài viết đủ dài để test quy trình chuẩn bị bình luận trong composer mà không thực hiện thao tác gửi lên nền tảng.</p>
        <button aria-label="Bình luận">Bình luận</button>
        <div contenteditable="true" role="textbox"></div>
      </div>
    `)

    const article = win.document.querySelector('[role="article"]') as unknown as HTMLElement
    article.scrollIntoView = () => undefined
    const [post] = facebookAdapter.scan(1)
    const result = await facebookAdapter.prepareComment(post.id, 'Một bình luận đã được người dùng duyệt.')

    expect(result.prepared).toBe(true)
    expect(result.composerText).toContain('Một bình luận đã được người dùng duyệt.')
    expect(win.document.querySelector('[contenteditable="true"]')?.textContent).toContain('Một bình luận')
  })

  it('reports degraded health when account evidence is missing', () => {
    installDom(`
      <main>
        <div role="article">
          <strong>Người đăng</strong>
          <p>Nội dung bài viết này đủ dài để adapter có thể nhận diện một article nhưng không có bằng chứng về account context trong navigation hoặc header.</p>
        </div>
      </main>
    `, 'https://www.facebook.com/groups/example')

    const context = facebookAdapter.getContext()
    expect(context.surface).toBe('GROUP')
    expect(context.account).toBeUndefined()

    const diagnostic = facebookAdapter.diagnose()
    expect(diagnostic.health).toBe('DEGRADED')
    expect(diagnostic.warnings).toContain('Chưa nhận diện được account context.')
  })
})
