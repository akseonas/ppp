/** @decorator */

import { Page } from './page.js';
import { observable } from './element/observation/observable.js';
import { debounce } from './ppp-throttle.js';
import { validate } from './validate.js';
import ppp from '../ppp.js';

export class InstrumentsManagePage extends Page {
  collection = 'instruments';

  /**
   * @children
   */
  @observable
  exchangeCheckboxes;

  /**
   * @children
   */
  @observable
  brokerCheckboxes;

  /**
   * True if the searching process has been finished.
   * @type {boolean}
   */
  @observable
  searchEnded;

  /**
   * The search text field value.
   * @type {string}
   */
  @observable
  searchText;

  /**
   * True if the instrument was not found.
   * @type {boolean}
   */
  @observable
  notFound;

  searchTextChanged(oldValue, newValue) {
    this.notFound = false;

    ppp.app.setURLSearchParams({
      symbol: encodeURIComponent(newValue.trim())
    });

    if (!newValue) {
      this.document = {};
    }
  }

  @debounce(500)
  search() {
    if (this.searchText)
      void this.readDocument().finally(() => {
        this.searchEnded = true;
      });
  }

  connectedCallback() {
    this.notFound = false;
    this.searchEnded = true;

    const symbol = ppp.app.params()?.symbol;

    if (symbol) {
      // Wait for debounce
      this.searchText = decodeURIComponent(symbol).toUpperCase();
    } else {
      this.searchText = '';
    }

    super.connectedCallback();
  }

  getDocumentId() {
    return {
      symbol: (this.searchText ?? '').toUpperCase()
    };
  }

  failOperation(e) {
    if (e.name !== 'NotFoundError') {
      super.failOperation(e);
    } else {
      this.notFound = true;
    }
  }

  async read() {
    if (!this.searchText) return {};

    return (context) => {
      return context.services
        .get('mongodb-atlas')
        .db('ppp')
        .collection('[%#this.page.view.collection%]')
        .findOne(
          {
            symbol: '[%#payload.documentId.symbol%]'
          },
          {
            _id: 0
          }
        );
    };
  }

  async validate() {
    await validate(this.symbol);
    await validate(this.fullName);
    await validate(this.lot);
    await validate(this.minPriceIncrement);

    if (this.tinkoffCheckbox.checked) await validate(this.tinkoffFigi);
  }

  async update() {
    if (!this.searchEnded) {
      // Do nothing
      return false;
    }

    this.notFound = false;

    return {
      $set: {
        symbol: this.symbol.value.trim(),
        fullName: this.fullName.value.trim(),
        type: this.type.value,
        currency: this.currency.value,
        exchange: this.exchangeCheckboxes
          .filter((c) => c.checked)
          .map((c) => c.name),
        broker: this.brokerCheckboxes
          .filter((c) => c.checked)
          .map((c) => c.name),
        isin: this.isin.value.trim(),
        lot: Math.abs(this.lot.value) || 1,
        minPriceIncrement: Math.abs(
          this.minPriceIncrement.value?.replace(',', '.')
        ),
        spbexSymbol: this.spbexSymbol.value.trim(),
        tinkoffFigi: this.tinkoffFigi.value.trim(),
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    };
  }
}
