import datastore from './datastore.js';

const collection = () => datastore.__NAME_CAMEL__;

const create__NAME_PASCAL__ = async (values) => collection().create(values);
const get__NAME_PASCAL__ = async (idOrQuery) => collection().get(idOrQuery);
const list__NAME_PASCAL__ = async (query = {}, details) =>
  collection().collect(query, details);
const update__NAME_PASCAL__ = async (id, values, options) =>
  collection().update(id, values, options);

export default {
  create__NAME_PASCAL__,
  get__NAME_PASCAL__,
  list__NAME_PASCAL__,
  update__NAME_PASCAL__
};
