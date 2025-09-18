import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { isMonacoPreloaded, preloadMonacoEditor } from '@/lib/monaco-preload';
import { IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { Textarea } from './textarea';

export interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onScroll?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface TextEditorHandle {
  getScrollTop: () => number;
  setScrollTop: (scrollTop: number) => void;
  focus: () => void;
}

/**
 * 基于Monaco Editor的文本编辑器组件
 * 支持多光标编辑功能（Ctrl+Shift+鼠标点击）
 */
export const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(({
  value,
  onChange,
  onScroll,
  placeholder = '',
  className = '',
  style = {}
}, ref) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>();
  const monacoEl = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // 暴露编辑器方法给父组件
  useImperativeHandle(ref, () => ({
    getScrollTop: () => {
      if (useFallback && textareaRef.current) {
        return textareaRef.current.scrollTop;
      }
      return editorRef.current?.getScrollTop() || 0;
    },
    setScrollTop: (scrollTop: number) => {
      if (useFallback && textareaRef.current) {
        textareaRef.current.scrollTop = scrollTop;
      } else {
        editorRef.current?.setScrollTop(scrollTop);
      }
    },
    focus: () => {
      if (useFallback && textareaRef.current) {
        textareaRef.current.focus();
      } else {
        editorRef.current?.focus();
      }
    }
  }));

  // 初始化Monaco Editor - 使用与script-form相同的模式
  useEffect(() => {
    const initializeEditor = async () => {
      try {
        // 如果 Monaco 还没有预加载，先预加载
        if (!isMonacoPreloaded()) {
          await preloadMonacoEditor();
        }

        if (!monacoEl.current) {
          setUseFallback(true);
          return;
        }

        // 创建编辑器 - 使用简化但完整的配置
        editorRef.current = monaco.editor.create(monacoEl.current, {
          value: value || '',
          language: 'plaintext',
          theme: 'vs',
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          fontSize: 14,
          lineHeight: 24,
          padding: { top: 8, bottom: 8 },
          // 启用多光标编辑
          multiCursorModifier: 'ctrlCmd',
          selectionHighlight: true,
          occurrencesHighlight: 'singleFile',
          // 隐藏行号（因为我们有自定义的行号区域）
          lineNumbers: 'off',
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0
        });

        setIsEditorReady(true);
      } catch (error) {
        console.error('初始化Monaco Editor失败:', error);
        setUseFallback(true);
      }
    };

    if (!useFallback) {
      initializeEditor();
    }

    return () => {
      editorRef.current?.dispose();
    };
  }, [useFallback]);

  // 设置事件监听器 - 使用与script-form相同的模式
  useEffect(() => {
    if (!isEditorReady || !editorRef.current) return;

    // 内容变化监听器
    const contentListener = editorRef.current.onDidChangeModelContent(() => {
      const newValue = editorRef.current?.getValue() || '';
      onChange(newValue);
    });

    // 滚动监听器
    let scrollListener: monaco.IDisposable | undefined;
    if (onScroll) {
      scrollListener = editorRef.current.onDidScrollChange(() => {
        onScroll();
      });
    }

    return () => {
      contentListener?.dispose();
      scrollListener?.dispose();
    };
  }, [isEditorReady, onChange, onScroll]);

  // 当外部value变化时更新编辑器内容
  useEffect(() => {
    if (!isEditorReady || !editorRef.current) return;
    
    const currentValue = editorRef.current.getValue();
    if (currentValue !== value) {
      // 保存当前光标位置
      const selection = editorRef.current.getSelection();
      editorRef.current.setValue(value);
      // 恢复光标位置
      if (selection) {
        editorRef.current.setSelection(selection);
      }
    }
  }, [value, isEditorReady]);

  // 处理Textarea的滚动事件
  const handleTextareaScroll = () => {
    if (onScroll) {
      onScroll();
    }
  };

  // 如果Monaco Editor加载失败，使用fallback textarea
  if (useFallback) {
    return (
      <div className={`w-full h-full flex flex-col ${className}`} style={style}>
        <div className="flex items-center gap-2 text-amber-600 text-xs mb-2 px-2 shrink-0">
          <IconAlertCircle className="h-3 w-3" />
          <span>编辑器加载失败，已切换到基础模式（不支持多光标编辑）</span>
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleTextareaScroll}
          placeholder={placeholder}
          className="resize-none font-mono border-none focus-visible:ring-0 leading-6 bg-transparent flex-1 w-full"
          style={{ 
            lineHeight: '1.5rem',
            padding: '0.5rem',
            minHeight: style.minHeight || '200px'
          }}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`} style={style}>
      {!isEditorReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">正在初始化编辑器...</span>
          </div>
        </div>
      )}
      <div 
        ref={monacoEl}
        className="w-full h-full overflow-hidden"
        style={{ 
          visibility: isEditorReady ? 'visible' : 'hidden',
          height: isEditorReady ? '100%' : '0',
          minHeight: style.minHeight || '200px'
        }}
      />
    </div>
  );
});

TextEditor.displayName = 'TextEditor';
