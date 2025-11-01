import AdmZip from 'adm-zip';

const zip = new AdmZip();

zip.addLocalFolder("src");
zip.addLocalFile("../../assets/Ripple.tmbundle/Syntaxes/ripple.tmLanguage", "Ripple.tmLanguage");

zip.writeZip("Ripple.sublime-package");

console.log("Built Ripple.sublime-package");
