import type { RULE_SCRIPT_TYPE, Rule, RuleScriptInfo } from '@/lib/rule';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef, useState, type FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { isMonacoPreloaded, preloadMonacoEditor } from '@/lib/monaco-preload';
import { IconLoader2 } from '@tabler/icons-react';
import './rule-script-form-worker';
import classes from './rule-script-form.module.css';

export const RuleScriptForm: FC = () => {
  const form = useFormContext<Rule<typeof RULE_SCRIPT_TYPE, RuleScriptInfo>>();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>();
  const monacoEl = useRef<HTMLDivElement>(null);
  const initValue = form.getValues('info.script');
  const [isEditorReady, setIsEditorReady] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const initializeEditor = async () => {
      // 如果 Monaco 还没有预加载，先预加载
      if (!isMonacoPreloaded()) {
        await preloadMonacoEditor();
      }

      // 创建编辑器
      editorRef.current = monaco.editor.create(monacoEl.current!, {
        value: initValue,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 14,
        lineHeight: 20,
        padding: { top: 10, bottom: 10 },
      });

      setIsEditorReady(true);
    };

    initializeEditor();

    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isEditorReady || !editorRef.current) return;

    const listener = editorRef.current.onDidChangeModelContent(() => {
      const value = editorRef.current?.getValue();

      if (value) {
        form.setValue('info.script', value);
      }
    });

    return () => {
      listener?.dispose();
    };
  }, [form.setValue, isEditorReady]);

  return (
    <div className="size-full">
      {!isEditorReady && (
        <div className="flex size-full items-center justify-center gap-x-2">
          <IconLoader2 className="animate-spin h-5 w-5" />
          <span>正在初始化编辑器...</span>
        </div>
      )}
      <div 
        ref={monacoEl} 
        className={classes.editor}
        style={{ 
          visibility: isEditorReady ? 'visible' : 'hidden',
          height: isEditorReady ? '100%' : '0'
        }} 
      />
    </div>
  );
};

