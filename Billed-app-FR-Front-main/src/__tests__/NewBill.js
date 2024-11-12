/**
 * @jest-environment jsdom
 */

import { screen, waitFor, fireEvent } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import NewBillUI from "../views/NewBillUI.js"
import NewBill from "../containers/NewBill.js"
import { localStorageMock } from "../__mocks__/localStorage.js";
import router from "../app/Router.js";
import { ROUTES_PATH } from "../constants/routes.js";
import mockStore from "../__mocks__/store.js";


describe("Given I am connected as an employee", () => {
  describe("When I am on NewBill Page", () => {
    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });
      window.localStorage.setItem('user', JSON.stringify({ type: 'Employee' }));
      document.body.innerHTML = `<div id="root"></div>`;
      router();
      window.onNavigate(ROUTES_PATH.NewBill);
    });

    test("Then NewBill icon in vertical layout should be highlighted", async () => {
      await waitFor(() => screen.getByTestId('icon-mail'));
      const mailIcon = screen.getByTestId('icon-mail');
      expect(mailIcon.classList.contains('active-icon')).toBeTruthy();
    });

    test("Then all inputs form should be rendered correctly", () => {
      document.body.innerHTML = NewBillUI();
      const fields = ["expense-name", "expense-type", "amount", "datepicker", "vat", "pct", "commentary", "file"];
      fields.forEach(field => expect(screen.getByTestId(field)).toBeTruthy());
    });

    describe("When I upload a file", () => {
      let newBill, fileInput;
      beforeEach(() => {
        document.body.innerHTML = NewBillUI();
        newBill = new NewBill({ document, onNavigate: jest.fn(), store: mockStore, localStorage: window.localStorage });
        fileInput = screen.getByTestId('file');
      });

      test("Then if the format is correct the file name is displayed", async () => {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpg' });

        const handleChangeFile = jest.fn(newBill.handleChangeFile);
        fileInput.addEventListener('change', handleChangeFile);

        await userEvent.upload(fileInput, file);

        expect(handleChangeFile).toHaveBeenCalled();
        await waitFor(() => expect(newBill.fileName).toBe('test.jpg'));
        expect(fileInput.files[0].name).toBe("test.jpg");
      });

      test("Then if the format is incorrect, an alert is shown", async () => {
        const invalidFile = new File(['dummy content'], 'file.pdf', { type: 'application/pdf' });

        window.alert = jest.fn();

        await userEvent.upload(fileInput, invalidFile);

        expect(window.alert).toHaveBeenCalledWith('png jpg jpeg only');
        expect(fileInput.value).toBe('');
      });
    });

    describe("When I submit the form with valid inputs", () => {
      let newBill, form;
      const mockNavigate = jest.fn();

      beforeEach(() => {
        document.body.innerHTML = NewBillUI();
        newBill = new NewBill({ document, onNavigate: mockNavigate, store: mockStore, localStorage: window.localStorage });
        form = screen.getByTestId("form-new-bill");
      });

      const fillFormFields = async () => {
        await userEvent.type(screen.getByTestId("expense-name"), "Frais de transport");
        await userEvent.selectOptions(screen.getByTestId("expense-type"), "Transports");
        await userEvent.type(screen.getByTestId("datepicker"), "2023-09-01");
        await userEvent.type(screen.getByTestId("amount"), "100");
        await userEvent.type(screen.getByTestId("vat"), "20");
        await userEvent.type(screen.getByTestId("pct"), "20");
        await userEvent.type(screen.getByTestId("commentary"), "Voyage d'affaires");
      };

      test("It should call the POST API and redirect to the Bills page", async () => {
        await fillFormFields();

        const file = new File(['dummy content'], 'receipt.jpg', { type: 'image/jpg' });
        const fileInput = screen.getByTestId("file");
        await userEvent.upload(fileInput, file);
        expect(newBill.fileName).toBe('receipt.jpg');

        const createBill = jest.spyOn(mockStore.bills(), 'create').mockResolvedValueOnce({
          fileUrl: 'https://localhost:3456/images/test.jpg',
          key: '1234'
        });

        const handleSubmit = jest.fn(newBill.handleSubmit);
        form.addEventListener('submit', handleSubmit);
        await fireEvent.submit(form);

        expect(handleSubmit).toHaveBeenCalled();
        await waitFor(() => expect(createBill).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.any(FormData),
          headers: { noContentType: true }
        })));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(ROUTES_PATH['Bills']));
      });

      describe("When an API error occurs on creating a new bill", () => {
        beforeEach(async () => {
          await fillFormFields();
          const file = new File(['dummy content'], 'receipt.jpg', { type: 'image/jpg' });
          const fileInput = screen.getByTestId("file");
          await userEvent.upload(fileInput, file);
        });

        test("It should log a 404 error message when the API returns a 404 error", async () => {
          jest.spyOn(console, 'error');
          jest.spyOn(mockStore.bills(), 'create').mockRejectedValueOnce(new Error("Erreur 404"));

          const handleSubmit = jest.fn(newBill.handleSubmit);
          form.addEventListener('submit', handleSubmit);
          await fireEvent.submit(form);

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(Error)));
          expect(console.error).toHaveBeenCalledWith(new Error("Erreur 404"));
        });

        test("It should log a 500 error message when the API returns a 500 error", async () => {
          jest.spyOn(console, 'error');
          jest.spyOn(mockStore.bills(), 'create').mockRejectedValueOnce(new Error("Erreur 500"));

          const handleSubmit = jest.fn(newBill.handleSubmit);
          form.addEventListener('submit', handleSubmit);
          await fireEvent.submit(form);

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(Error)));
          expect(console.error).toHaveBeenCalledWith(new Error("Erreur 500"));
        });
      });
    });
  });
});
