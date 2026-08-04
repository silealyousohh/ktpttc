from bs4 import BeautifulSoup
with open("Admin_Index.html", "r") as f:
    soup = BeautifulSoup(f, 'html.parser')

modal = soup.find(id="modal-add-book")
print("modal-add-book exists:", modal is not None)

form = modal.find(id="addBookForm") if modal else None
print("addBookForm exists:", form is not None)

btn = form.find("button", type="submit") if form else None
print("submit button exists:", btn is not None)

bookCodeInput = form.find(id="bookCodeInput") if form else None
print("bookCodeInput exists:", bookCodeInput is not None)

print("openModal in script:", "function openModal" in str(soup))
print("saveNewBook in script:", "function saveNewBook" in str(soup))
