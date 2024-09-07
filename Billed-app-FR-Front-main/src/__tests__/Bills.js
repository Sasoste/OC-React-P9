/**
 * @jest-environment jsdom
 */

import { screen, waitFor } from "@testing-library/dom";
import userEvent from '@testing-library/user-event';
import Bills from "../containers/Bills.js";
import BillsUI from "../views/BillsUI.js";
import { bills } from "../fixtures/bills.js";
import { rows } from "../views/BillsUI.js";
import { ROUTES_PATH, ROUTES } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import router from "../app/Router.js";
import store from "../__mocks__/store.js";


describe("Given I am connected as an employee", () => {
  describe("When I am on Bills Page", () => {
    test("Then bill icon in vertical layout should be highlighted", async () => {
      Object.defineProperty(window, 'localStorage', { value: localStorageMock })
      window.localStorage.setItem('user', JSON.stringify({
        type: 'Employee'
      }))
      const root = document.createElement("div")
      root.setAttribute("id", "root")
      document.body.append(root)
      router()
      window.onNavigate(ROUTES_PATH.Bills)
      await waitFor(() => screen.getByTestId('icon-window'))
      const windowIcon = screen.getByTestId('icon-window')
      expect(windowIcon.classList.contains('active-icon')).toBeTruthy()
    })
    test("Then bills should be ordered from earliest to latest", () => {
      document.body.innerHTML = BillsUI({ data: bills })
      const dates = screen.getAllByText(/^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i).map(a => a.innerHTML)
      const antiChrono = (a, b) => ((a < b) ? 1 : -1)
      const datesSorted = [...dates].sort(antiChrono)
      expect(dates).toEqual(datesSorted)
    })
    test("Then bills return an empty string if data is empty", () => {
      const result = rows([])
      expect(result).toBe('')
    })
    describe("When I click on the 'New Bill' button", () => {
      test("Then it should navigate to the NewBill page", async () => {
        document.body.innerHTML = BillsUI({ data: bills });
        const buttonNewBill = screen.getByTestId('btn-new-bill');

        const onNavigate = (pathname) => {
          document.body.innerHTML = ROUTES({ pathname });
          window.history.pushState({}, '', pathname);
        };
        const billsContainer = new Bills({ document, onNavigate, store: null, localStorage: window.localStorage });
        buttonNewBill.addEventListener('click', billsContainer.handleClickNewBill);

        userEvent.click(buttonNewBill);
        await expect(window.location.href).toContain(ROUTES_PATH['NewBill']);
      });
    });
    describe("When I click on the eye icon", () => {
      test("Then it should display the image in a modal", async () => {
        document.body.innerHTML = BillsUI({ data: bills });

        const iconEye = screen.getAllByTestId('icon-eye')[0];

        const mockModal = jest.fn();
        $.fn.modal = mockModal;

        const billsContainer = new Bills({ document, onNavigate: null, store: null, localStorage: window.localStorage });

        iconEye.addEventListener('click', () => billsContainer.handleClickIconEye(iconEye));

        userEvent.click(iconEye);

        await waitFor(() => expect(screen.getByText('Justificatif')).toBeTruthy());

        expect(mockModal).toHaveBeenCalledWith('show');

        const billUrl = iconEye.getAttribute('data-bill-url');
        const imgInModal = screen.getByAltText('Bill');
        expect(imgInModal.getAttribute('src')).toBe(billUrl);
      });
    });
    describe("And bills are fetched", () => {
      test("fetches bills from mock API GET", async () => {
        Object.defineProperty(window, 'localStorage', { value: localStorageMock })
        window.localStorage.setItem('user', JSON.stringify({
          type: 'Employee'
        }))
        const root = document.createElement("div")
        root.setAttribute("id", "root")
        document.body.append(root)
        router()
        window.onNavigate(ROUTES_PATH.Bills)

        const billsContainer = new Bills({ document, onNavigate: window.onNavigate, store: store, localStorage: window.localStorage });

        const spyGetBills = jest.spyOn(billsContainer, 'getBills');

        await billsContainer.getBills();

        expect(spyGetBills).toHaveBeenCalled();
        await waitFor(() => screen.getByTestId('tbody'));

        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1);

        const firstBillDate = screen.getByText('2004-04-04');
        expect(firstBillDate).toBeTruthy();
      })
      test("logs error and returns unformatted data if data is corrupted", async () => {
        const corruptedData = [{
          id: "47qAXb6fIm2zOKkLzMro",
          vat: "80",
          fileUrl: "https://test.storage.tld/v0/b/billable-677b6.a…f-1.jpg?alt=media&token=c1640e12-a24b-4b11-ae52-529112e9602a",
          status: "pending",
          type: "Hôtel et logement",
          date: "INVALID_DATE",
          amount: 400,
          email: "a@a"
        }];

        store.bills = jest.fn(() => ({
          list: jest.fn().mockResolvedValue(corruptedData)
        }));

        const consoleSpy = jest.spyOn(console, 'log');

        const billsContainer = new Bills({ document, onNavigate: window.onNavigate, store: store, localStorage: window.localStorage });
        const bills = await billsContainer.getBills();

        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error), 'for', corruptedData[0]);

        expect(bills[0].date).toBe("INVALID_DATE");

        consoleSpy.mockRestore();
      });
    });
  })
})