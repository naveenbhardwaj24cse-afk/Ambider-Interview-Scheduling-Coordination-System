const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if(file.endsWith('.jsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./client/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Replace 'http://localhost:5000/api/...' -> `${import.meta.env.VITE_API_URL}/...`
    const singleQuoteRegex = /'http:\/\/localhost:5000\/api([^']+)'/g;
    if (singleQuoteRegex.test(content)) {
        content = content.replace(singleQuoteRegex, '`${import.meta.env.VITE_API_URL}$1`');
        changed = true;
    }

    // Replace `http://localhost:5000/api/...` -> `${import.meta.env.VITE_API_URL}/...`
    const backtickRegex = /`http:\/\/localhost:5000\/api([^`]*)`/g;
    if (backtickRegex.test(content)) {
        content = content.replace(backtickRegex, '`${import.meta.env.VITE_API_URL}$1`');
        changed = true;
    }

    // Replace `http://localhost:5000${... -> `${import.meta.env.VITE_API_URL.replace('/api', '')}${...
    const bareHostRegex = /`http:\/\/localhost:5000\$\{/g;
    if (bareHostRegex.test(content)) {
        content = content.replace(bareHostRegex, '`${import.meta.env.VITE_API_URL.replace(\'/api\', \'\')}${');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed:', file);
    }
});
