import path from "node:path";
import pug from "pug";

type TemplateValues = Record<string, unknown>;

const templateCache = new Map<string, pug.compileTemplate>();

function getTemplatePath(templateName: string): string {
  return path.join(__dirname, "templates", templateName);
}

export function readTemplate(templateName: string): pug.compileTemplate {
  const cachedTemplate = templateCache.get(templateName);

  if (cachedTemplate) {
    return cachedTemplate;
  }

  const template = pug.compileFile(getTemplatePath(templateName), {
    compileDebug: false
  });
  templateCache.set(templateName, template);

  return template;
}

export function renderTemplate(templateName: string, values: TemplateValues): string {
  return readTemplate(templateName)(values);
}
