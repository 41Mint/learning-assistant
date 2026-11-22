import type { Mode } from 'highlight.js';
import { common } from 'lowlight';
import type { LanguageFn } from 'lowlight';

const space = '[ \\t]*';
const separator = '[ \\t]+';
const prefix = /\b(?:(?:public|private|protected|internal|static|virtual|override|abstract|readonly|sealed|required|volatile|new|unsafe|const|extern|partial)[ \t]+)+/;
const memberAccess = /(?<!\.)\??\.[ \t]*/;

const csharp: LanguageFn = (hljs) => {
  const grammar = common.csharp(hljs);
  const identifier = '@?' + hljs.IDENT_RE;
  const qualified = `${identifier}(?:${space}\\.${space}${identifier})*`;
  const suffix = String.raw`\??(?:[ \t]*\[,*\]\??)*`;
  const argumentsOf = (type: string) => `${space}${type}(?:${space},${space}${type})*${space}`;
  const plainType = qualified + suffix;
  const genericType = `${qualified}(?:<${argumentsOf(plainType)}>)?${suffix}`;
  const typeArguments = argumentsOf(genericType);
  const type = `${qualified}(?:<${typeArguments}>)?${suffix}`;
  const builtIns = typeof grammar.keywords === 'object' && !Array.isArray(grammar.keywords) ? grammar.keywords.built_in : undefined;
  const builtInNames = Array.isArray(builtIns) ? builtIns.filter((name) => name !== 'delegate' && name !== 'enum').join('|') : '(?!)';
  const constructorType = `(?!(?:${builtInNames})\\b)${qualified}`;
  const declarationType = `(?!(?:class|struct|enum|interface|record|delegate|event|operator)\\b)${type}`;

  // These forms can be identified from the snippet without resolving types in the project.
  const declarations = [
    { typePattern: `(?:${builtInNames})\\b${suffix}`, typeScope: 'built_in' },
    { typePattern: declarationType, typeScope: 'title.class' },
  ].flatMap(({ typePattern, typeScope }): Mode[] => [
    {
      match: [prefix, typePattern, separator, identifier, /(?=\s*(?:=>|\{))/],
      scope: { 1: 'keyword', 2: typeScope, 4: 'property.csharp' },
      relevance: 0,
    },
    {
      match: [prefix, typePattern, separator, identifier, /(?=[ \t]*(?:[;,]|=(?!=|>)))/],
      scope: { 1: 'keyword', 2: typeScope },
      relevance: 0,
    },
  ]);

  const extra: Mode[] = [
    {
      match: [/\bnamespace[ \t]+/, qualified, /(?=\s*(?:\{|;))/],
      scope: { 1: 'keyword', 2: 'title.class' },
      relevance: 0,
    },
    {
      match: [/\busing[ \t]+/, /(?:static[ \t]+)?/, `(?:${identifier}${space}=${space})?`, qualified, /(?=[ \t]*;)/],
      scope: { 1: 'keyword', 2: 'keyword', 4: 'title.class' },
      relevance: 0,
    },
    ...declarations,
    {
      match: [/\bnew[ \t]+/, constructorType, /(?=[ \t]*(?:\(|<|\[|\{))/],
      scope: { 1: 'keyword', 2: 'title.class' },
      relevance: 0,
    },
    {
      match: [memberAccess, identifier, /[ \t]*</, typeArguments, />[ \t]*(?=\()/],
      scope: { 2: 'title.function', 4: 'title.class' },
      relevance: 0,
    },
    {
      match: [memberAccess, identifier, /(?=[ \t]*\()/],
      scope: { 2: 'title.function' },
      relevance: 0,
    },
    { match: [memberAccess, identifier], scope: { 2: 'property.csharp' }, relevance: 0 },
    { match: /=>|(?<![=!<>])=(?!=)/, scope: 'operator.csharp', relevance: 0 },
  ];
  return { ...grammar, contains: [...extra, ...grammar.contains] };
};

export const codeHighlightOptions = { languages: { ...common, csharp } };
