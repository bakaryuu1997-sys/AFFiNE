import { Button, IconButton, Modal } from '@affine/component';
import { DocsService } from '@affine/core/modules/doc';
import { AiOutlineIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useRef, useState } from 'react';

interface InlineAiButtonProps {
  docId: string;
}

export const InlineAiButton = ({ docId }: InlineAiButtonProps) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const docsService = useService(DocsService);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getDocText = useCallback(() => {
    try {
      const docRecord = docsService.list.doc$(docId).value;
      if (!docRecord) return '';
      const doc = docRecord.blockSuiteDoc;
      const title = doc?.meta?.title ?? '';
      return `Tiêu đề: ${title}`;
    } catch {
      return '';
    }
  }, [docId, docsService]);

  const handleAsk = useCallback(
    async (userPrompt: string) => {
      if (!userPrompt.trim()) return;
      setLoading(true);
      setResponse('');
      setCopied(false);

      const docContext = getDocText();
      const messages = [
        {
          role: 'system',
          content:
            'Bạn là Trợ lý AI thông minh tích hợp trong ứng dụng AFFiNE Cá nhân. Hãy trả lời súc tích, chuyên nghiệp bằng tiếng Việt và định dạng Markdown dễ đọc.',
        },
        {
          role: 'user',
          content: `${docContext ? `Ngữ cảnh tài liệu hiện tại: ${docContext}\n\n` : ''}Yêu cầu: ${userPrompt}`,
        },
      ];

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch('http://localhost:20129/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'free-logic',
            messages,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(
            `Lỗi kết nối AI (${res.status}): Vui lòng kiểm tra 9Router/AI Proxy`
          );
        }

        const data = await res.json();
        const content =
          data.choices?.[0]?.message?.content ??
          'Không nhận được phản hồi từ AI.';
        setResponse(content);
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e.name !== 'AbortError') {
          setResponse(`❌ Yêu cầu thất bại: ${e.message ?? String(err)}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [getDocText]
  );

  const handleCopy = useCallback(() => {
    if (!response) return;
    navigator.clipboard
      .writeText(response)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, [response]);

  return (
    <>
      <IconButton
        tooltip="Trợ lý AI Tài liệu"
        onClick={() => setOpen(true)}
        style={{
          color: 'var(--affine-primary-color, #1e96eb)',
          marginRight: '4px',
        }}
      >
        <AiOutlineIcon />
      </IconButton>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="✨ Trợ lý AI Tài liệu (Local AI)"
        width={560}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px 0',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setPrompt('Tóm tắt 3 ý chính của tài liệu này');
                handleAsk('Tóm tắt 3 ý chính của tài liệu này').catch(() => {});
              }}
              disabled={loading}
            >
              📑 Tóm tắt 3 ý
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPrompt('Gợi ý cải tiến và bổ sung nội dung cho tài liệu');
                handleAsk(
                  'Gợi ý cải tiến và bổ sung nội dung cho tài liệu'
                ).catch(() => {});
              }}
              disabled={loading}
            >
              💡 Gợi ý cải tiến
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setPrompt('Dịch tiêu đề và phác thảo nội dung sang Tiếng Anh');
                handleAsk(
                  'Dịch tiêu đề và phác thảo nội dung sang Tiếng Anh'
                ).catch(() => {});
              }}
              disabled={loading}
            >
              🌐 Dịch sang Tiếng Anh
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !loading) {
                  handleAsk(prompt).catch(() => {});
                }
              }}
              placeholder="Nhập yêu cầu cho AI (Enter để gửi)..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--affine-border-color, #333)',
                background: 'var(--affine-background-primary-color, #1e1e20)',
                color: 'var(--affine-text-primary-color, #eee)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <Button
              variant="primary"
              onClick={() => {
                handleAsk(prompt).catch(() => {});
              }}
              disabled={loading || !prompt.trim()}
            >
              {loading ? 'Đang nghĩ...' : 'Gửi'}
            </Button>
          </div>

          {response && (
            <div
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                background:
                  'var(--affine-hover-color, rgba(255, 255, 255, 0.05))',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--affine-text-primary-color, #ddd)',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid var(--affine-border-color, #444)',
              }}
            >
              {response}
            </div>
          )}

          {response && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <Button onClick={handleCopy} variant="secondary">
                {copied ? '✓ Đã sao chép!' : '📋 Sao chép câu trả lời'}
              </Button>
              <Button onClick={() => setOpen(false)}>Đóng</Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
