export const normalizeBcryptHash = (hash: string) => hash.replace(/^\$2y\$/u, '$2a$');

export const isPhpassHash = (hash: string) => /^\$[PH]\$/u.test(hash);

export const isBcryptHash = (hash: string) => /^\$2[aby]\$\d{2}\$[\w./]{53}$/u.test(hash);

export const isCryptMd5Hash = (hash: string) => /^\$1\$[^$]{1,8}\$[\w./]{22}$/u.test(hash);

export const isBcryptHashPrefix = (hash: string) => /^\$2[aby]\$/u.test(hash);
