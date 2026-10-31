import md5 from 'blueimp-md5';

export function hashPassword(password) {
  return md5(password); // 32-character hexadecimal MD5 digest
}