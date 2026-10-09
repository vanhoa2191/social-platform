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
    MutationObserver: win.MutationObserver,
  })
  return win
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'HTMLElement')
  Reflect.deleteProperty(globalThis, 'Element')
  Reflect.deleteProperty(globalThis, 'InputEvent')
  Reflect.deleteProperty(globalThis, 'MutationObserver')
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
        <a href="https://www.facebook.com/example/posts/999">2 giờ</a>
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

  it('keeps post identity stable when visible article text changes', async () => {
    const win = installDom(`
      <nav role="navigation">
        <a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a>
      </nav>
      <div role="article">
        <p>Đây là nội dung đủ dài để quét bài viết và sau đó mô phỏng bộ đếm hoặc nội dung phụ thay đổi trên giao diện Facebook.</p>
        <a href="https://www.facebook.com/example/posts/777">2 giờ</a>
        <button aria-label="Bình luận">Bình luận</button>
        <div contenteditable="true" role="textbox"></div>
      </div>
    `)
    const article = win.document.querySelector('[role="article"]')
    ;(article as unknown as HTMLElement).scrollIntoView = () => undefined
    const [post] = facebookAdapter.scan(1)
    article?.querySelector('p')?.append(' 12 lượt thích')
    const result = await facebookAdapter.prepareComment(post.id, 'Nội dung đã duyệt chính xác.')
    expect(result.prepared).toBe(true)
  })

  it('does not fall back to a global composer from another post', async () => {
    const win = installDom(`
      <nav role="navigation">
        <a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a>
      </nav>
      <div role="article">
        <p>Bài viết mục tiêu đủ dài để quét nhưng cố ý không có composer cục bộ nhằm kiểm tra cơ chế fail closed.</p>
        <a href="https://www.facebook.com/example/posts/888">2 giờ</a>
        <button aria-label="Bình luận">Bình luận</button>
      </div>
      <div contenteditable="true" role="textbox" id="other-composer"></div>
    `)
    const article = win.document.querySelector('[role="article"]') as unknown as HTMLElement
    article.scrollIntoView = () => undefined
    const [post] = facebookAdapter.scan(1)
    await expect(facebookAdapter.prepareComment(post.id, 'Không được nhập nhầm.')).rejects.toThrow('đã dừng')
    expect(win.document.querySelector('#other-composer')?.textContent).toBe('')
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
  it('uses canonical permalink identity when two posts have the same visible text', () => {
    installDom(`
      <nav role="navigation"><a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a></nav>
      <div role="article"><strong>Cùng tác giả</strong><p>Đây là cùng một phần nội dung đủ dài để kiểm tra hai bài giống nhau vẫn có danh tính khác nhau nhờ permalink ổn định của Facebook.</p><a href="https://www.facebook.com/example/posts/111?__cft__=tracking">1 giờ</a></div>
      <div role="article"><strong>Cùng tác giả</strong><p>Đây là cùng một phần nội dung đủ dài để kiểm tra hai bài giống nhau vẫn có danh tính khác nhau nhờ permalink ổn định của Facebook.</p><a href="https://www.facebook.com/example/posts/222?__cft__=tracking">2 giờ</a></div>
    `)
    const posts = facebookAdapter.scan(10)
    expect(posts).toHaveLength(2)
    expect(posts[0].id).not.toBe(posts[1].id)
    expect(posts[0].permalink).toBe('https://www.facebook.com/example/posts/111')
    expect(posts[1].permalink).toBe('https://www.facebook.com/example/posts/222')
  })

  it('waits for a composer inserted after clicking Comment', async () => {
    const win = installDom(`
      <nav role="navigation"><a aria-label="Profile" href="https://www.facebook.com/profile.php?id=123">Nguyễn Văn A</a></nav>
      <div role="article"><strong>Trần Minh</strong><p>Bài viết này đủ dài để kiểm tra MutationObserver chờ composer xuất hiện sau khi Facebook render bất đồng bộ.</p><a href="https://www.facebook.com/example/posts/789">1 giờ</a><button aria-label="Bình luận">Bình luận</button></div>
    `)
    const article = win.document.querySelector('[role="article"]') as unknown as HTMLElement
    article.scrollIntoView = () => undefined
    const button = win.document.querySelector('button') as unknown as HTMLElement
    button.addEventListener('click', () => {
      win.setTimeout(() => {
        const composer = win.document.createElement('div')
        composer.setAttribute('contenteditable', 'true')
        composer.setAttribute('role', 'textbox')
        ;(article as any).appendChild(composer as any)
      }, 20)
    })
    const [post] = facebookAdapter.scan(1)
    const result = await facebookAdapter.prepareComment(post.id, 'Nội dung được chờ đúng composer.')
    expect(result.prepared).toBe(true)
  })

})
