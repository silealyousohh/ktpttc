const fs = require('fs');
const html = fs.readFileSync('Admin_Index.html', 'utf8');
console.log('modal-add-book:', html.includes('id="modal-add-book"'));
console.log('addBookForm:', html.includes('id="addBookForm"'));
console.log('openModal function:', html.includes('function openModal'));
console.log('saveNewBook function:', html.includes('function saveNewBook'));

// Let's check bookGradeInput
console.log('bookGradeInput:', html.includes('id="bookGradeInput"'));
// check if button inside form
const formMatch = html.match(/<form id="addBookForm"[\s\S]*?<\/form>/);
if (formMatch) {
    console.log('submit inside form:', formMatch[0].includes('type="submit"'));
}
