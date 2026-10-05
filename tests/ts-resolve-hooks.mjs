// Tenta novamente com ".ts" quando um import relativo sem extensão não resolve.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return next(specifier + '.ts', context);
    }
    throw err;
  }
}
