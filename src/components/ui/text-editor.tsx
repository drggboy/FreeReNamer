import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { isMonacoPreloaded, preloadMonacoEditor } from '@/lib/monaco-preload';
import { IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { Textarea } from './textarea';

// 检测是否为生产环境的Tauri应用
const isProductionTauri = () => {
  const isProduction = import.meta.env.PROD;
  // @ts-ignore
  const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;
  return isProduction && isTauri;
};

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
  const renderLoopRef = useRef<number>();

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
          console.log('Monaco Editor 未预加载，开始预加载...');
          await preloadMonacoEditor();
        }

        if (!monacoEl.current) {
          console.warn('Monaco 容器元素不存在，切换到fallback模式');
          setUseFallback(true);
          return;
        }

        // 等待一小段时间确保DOM元素完全准备好
        await new Promise(resolve => setTimeout(resolve, 50));

        // 获取生产环境特定配置
        const isProdTauri = isProductionTauri();
        const editorConfig: monaco.editor.IStandaloneEditorConstructionOptions = {
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
          lineNumbersMinChars: 0,
          // 确保光标可见性
          cursorStyle: 'line',
          cursorWidth: isProdTauri ? 3 : 2, // 在生产环境中使用更粗的光标
          cursorSurroundingLines: 0,
          cursorSurroundingLinesStyle: 'default',
          // 强制启用光标闪烁
          cursorBlinking: 'blink',
          // 确保编辑器可聚焦
          readOnly: false,
          domReadOnly: false,
          // 启用选择和交互
          selectOnLineNumbers: false,
          roundedSelection: false,
          // 确保在生产环境下的交互性
          contextmenu: true,
          mouseWheelZoom: false
        };

        // 生产环境特殊配置
        if (isProdTauri) {
          Object.assign(editorConfig, {
            // 在生产环境中强制一些设置
            autoClosingBrackets: 'never' as const,
            autoClosingQuotes: 'never' as const,
            autoSurround: 'never' as const,
            codeLens: false,
            colorDecorators: false,
            links: false,
            // 确保渲染性能
            renderControlCharacters: false,
            renderWhitespace: 'none' as const,
            renderLineHighlight: 'line' as const,
            // 强制光标可见
            hideCursorInOverviewRuler: false
          });
        }

        // 生产环境中完全禁用Monaco的选择渲染，改用浏览器原生::selection
        // 这样可以绕过WebView2的Monaco选择层渲染问题
        if (isProdTauri) {
          console.log('⚠️ 生产环境：禁用Monaco选择层，使用原生::selection');
          // 保持使用vs主题，但我们会在CSS中覆盖选择样式
          editorConfig.theme = 'vs';
        } else {
          // 开发环境使用自定义主题
          try {
            monaco.editor.defineTheme('custom-light', {
              base: 'vs',
              inherit: true,
              rules: [],
              colors: {
                'editor.selectionBackground': '#80BFFF',
                'editor.inactiveSelectionBackground': '#B3D9FF',
                'editor.selectionHighlightBackground': '#CCE5FF',
                'editor.lineHighlightBackground': '#F5F5F5',
              }
            });
            editorConfig.theme = 'custom-light';
            console.log('✅ Monaco自定义主题定义成功');
          } catch (e) {
            console.error('❌ Monaco主题定义失败:', e);
          }
        }

        // 创建编辑器 - 使用简化但完整的配置
        editorRef.current = monaco.editor.create(monacoEl.current, editorConfig);

        // 强制启用文本选择功能（生产环境修复）
        if (monacoEl.current) {
          monacoEl.current.style.userSelect = 'text';
          monacoEl.current.style.webkitUserSelect = 'text';
          monacoEl.current.style.cursor = 'text';
          
          // 为Monaco内部元素强制启用选择
          const viewLines = monacoEl.current.querySelector('.view-lines');
          if (viewLines) {
            (viewLines as HTMLElement).style.userSelect = 'text';
            (viewLines as HTMLElement).style.webkitUserSelect = 'text';
          }
          
          console.log('✅ 已强制启用Monaco Editor文本选择功能');
        }

        setIsEditorReady(true);
        console.log('Monaco Editor 初始化成功 (使用自定义主题)');
        
        
        // 确保编辑器在初始化后立即聚焦（如果需要）
        setTimeout(() => {
          if (editorRef.current && monacoEl.current) {
            editorRef.current.focus();
            
            // 在生产环境中强制重新布局和渲染，并创建自定义选择高亮
            if (isProdTauri) {
              editorRef.current.layout();
              editorRef.current.render(true);
              
              // 创建自定义选择高亮层（绕过WebView2的Monaco选择层渲染问题）
              
              const highlightOverlay = document.createElement('div');
              highlightOverlay.style.position = 'absolute';
              highlightOverlay.style.top = '0';
              highlightOverlay.style.left = '0';
              highlightOverlay.style.width = '100%';
              highlightOverlay.style.height = '100%';
              highlightOverlay.style.pointerEvents = 'none';
              highlightOverlay.style.zIndex = '10';
              highlightOverlay.className = 'custom-selection-overlay';
              
              const editorDom = editorRef.current.getDomNode();
              if (editorDom) {
                editorDom.style.position = 'relative';
                editorDom.appendChild(highlightOverlay);
              }
              
              // 保存当前选择的位置（行列号），不随滚动变化
              let savedSelection: { start: monaco.Position; end: monaco.Position } | null = null;
              
              // 更新高亮位置（根据当前滚动位置）
              const updateHighlightPosition = () => {
                if (!editorRef.current || !savedSelection) {
                  highlightOverlay.innerHTML = '';
                  return;
                }
                
                const model = editorRef.current.getModel();
                if (!model) return;
                
                const startPos = savedSelection.start;
                const endPos = savedSelection.end;
                
                highlightOverlay.innerHTML = '';
                
                // 获取当前滚动位置
                const scrollTop = editorRef.current.getScrollTop();
                const scrollLeft = editorRef.current.getScrollLeft();
                
                // 为每一行创建高亮div
                for (let lineNumber = startPos.lineNumber; lineNumber <= endPos.lineNumber; lineNumber++) {
                  // 获取行的绝对位置（不考虑滚动）
                  const lineTop = editorRef.current.getTopForLineNumber(lineNumber);
                  const lineHeight = editorRef.current.getOption(monaco.editor.EditorOption.lineHeight);
                  
                  const lineContent = model.getLineContent(lineNumber);
                  let startCol = lineNumber === startPos.lineNumber ? startPos.column : 1;
                  let endCol = lineNumber === endPos.lineNumber ? endPos.column : lineContent.length + 1;
                  
                  // 使用Monaco API精确获取列的像素位置（支持中文和变宽字体）
                  const startOffset = editorRef.current.getOffsetForColumn(lineNumber, startCol);
                  const endOffset = editorRef.current.getOffsetForColumn(lineNumber, endCol);
                  
                  const highlightDiv = document.createElement('div');
                  highlightDiv.style.position = 'absolute';
                  // 减去滚动偏移，使高亮固定在文本上
                  highlightDiv.style.top = `${lineTop - scrollTop}px`;
                  highlightDiv.style.height = `${lineHeight}px`;
                  highlightDiv.style.backgroundColor = '#ADD6FF';
                  highlightDiv.style.opacity = '0.5';
                  
                  // 使用精确的像素位置（减去水平滚动）
                  highlightDiv.style.left = `${startOffset - scrollLeft}px`;
                  highlightDiv.style.width = `${endOffset - startOffset}px`;
                  
                  highlightOverlay.appendChild(highlightDiv);
                }
              };
              
              // 监听选择变化 - 保存选择位置
              editorRef.current.onDidChangeCursorSelection(() => {
                if (!editorRef.current) return;
                
                const selection = editorRef.current.getSelection();
                const model = editorRef.current.getModel();
                
                if (!selection || !model || selection.isEmpty()) {
                  savedSelection = null;
                  highlightOverlay.innerHTML = '';
                  return;
                }
                
                savedSelection = {
                  start: selection.getStartPosition(),
                  end: selection.getEndPosition()
                };
                
                updateHighlightPosition();
              });
              
              // 监听滚动 - 更新高亮位置
              editorRef.current.onDidScrollChange(() => {
                updateHighlightPosition();
              });
              
              // 强制刷新光标位置
              const position = editorRef.current.getPosition();
              if (position) {
                editorRef.current.setPosition(position);
                editorRef.current.revealPosition(position);
              }

              // 添加滚动事件监听器来解决生产环境下的空白问题
              const scrollListener = () => {
                if (editorRef.current) {
                  // 强制重新渲染可视区域
                  editorRef.current.render(true);
                  
                  // 延迟一小段时间再次渲染，确保内容完全显示
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.render(true);
                    }
                  }, 16); // 一帧的时间
                }
              };

              // 监听滚动事件
              editorRef.current.onDidScrollChange(scrollListener);
              
              // 监听内容变化事件，确保内容更新时正确渲染
              editorRef.current.onDidChangeModelContent(() => {
                if (editorRef.current && isProductionTauri()) {
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.layout();
                      editorRef.current.render(true);
                    }
                  }, 0);
                }
              });

              // 使用Intersection Observer来检测可见性变化并触发重新渲染
              if (monacoEl.current && 'IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                  entries.forEach((entry) => {
                    if (entry.isIntersecting && editorRef.current) {
                      // 当编辑器进入视口时强制渲染
                      setTimeout(() => {
                        if (editorRef.current) {
                          editorRef.current.layout();
                          editorRef.current.render(true);
                        }
                      }, 50);
                    }
                  });
                }, {
                  threshold: 0.1, // 当10%的区域可见时触发
                  rootMargin: '50px' // 提前50px触发
                });

                observer.observe(monacoEl.current);
                
                // 保存observer引用以便清理
                (editorRef.current as any)._intersectionObserver = observer;
              }
            }
          }
        }, 100);
        
      } catch (error) {
        console.error('初始化Monaco Editor失败:', error);
        console.log('切换到fallback textarea模式');
        setUseFallback(true);
      }
    };

    if (!useFallback) {
      initializeEditor();
    }

    return () => {
      // 清理渲染循环
      if (renderLoopRef.current) {
        cancelAnimationFrame(renderLoopRef.current);
        renderLoopRef.current = undefined;
      }
      
      // 清理编辑器和观察器
      if (editorRef.current) {
        // 清理Intersection Observer
        const observer = (editorRef.current as any)._intersectionObserver;
        if (observer) {
          observer.disconnect();
        }
        
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
    };
  }, [useFallback]);

        // 设置事件监听器 - 使用与script-form相同的模式
  useEffect(() => {
    if (!isEditorReady || !editorRef.current) return;
    
    // 在生产环境中添加额外的滚动处理
    if (isProductionTauri()) {
      const handleWindowScroll = () => {
        if (editorRef.current) {
          // 使用防抖来避免过多的渲染调用
          clearTimeout((window as any)._monacoScrollTimeout);
          (window as any)._monacoScrollTimeout = setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.render(true);
            }
          }, 50);
        }
      };

      // 监听容器的滚动事件
      const container = monacoEl.current?.closest('[data-radix-scroll-area-viewport]') || 
                       monacoEl.current?.closest('.overflow-auto') ||
                       document.body;
      
      if (container) {
        container.addEventListener('scroll', handleWindowScroll, { passive: true });
        
        // 保存引用以便清理
        (editorRef.current as any)._scrollContainer = container;
        (editorRef.current as any)._scrollHandler = handleWindowScroll;
      }
    }

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
      
      // 清理滚动事件监听器
      if (editorRef.current) {
        const container = (editorRef.current as any)._scrollContainer;
        const handler = (editorRef.current as any)._scrollHandler;
        if (container && handler) {
          container.removeEventListener('scroll', handler);
        }
      }
      
      // 清理防抖定时器
      if ((window as any)._monacoScrollTimeout) {
        clearTimeout((window as any)._monacoScrollTimeout);
      }
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
          opacity: isEditorReady ? 1 : 0,
          height: '100%',
          minHeight: style.minHeight || '200px',
          // 确保在生产环境下容器可见
          backgroundColor: isEditorReady ? 'transparent' : '#ffffff',
          transition: 'opacity 0.2s ease-in-out'
        }}
      />
    </div>
  );
});

TextEditor.displayName = 'TextEditor';
