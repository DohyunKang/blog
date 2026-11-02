Normalization is the process of splitting tables so that the same fact isn't written in multiple places, and 1NF through 3NF are rules that break this down into three stages.

## Why split them?

At first, you want to write everything in one table, like in Excel. Writing one order with customer name, email, product, price, and quantity on a single line is convenient for viewing. The problem is that the same customer email and product price repeat on every row.

Microsoft documentation also starts with the same point. Normalization is the process of organizing data, and it involves creating tables and linking relationships according to rules that eliminate redundancy and incorrect dependencies. An example given is that to make changing a customer's address easier, the address should exist in only one place in the Customers table.

The problems caused by redundancy are usually referred to as three types (summarized from Wikipedia).

| Name | What happens? |
|---|---|
| Update Anomaly | Changing some rows with repeated values results in the same fact having two different answers. |
| Insertion Anomaly | You cannot insert a certain fact unless other data exists (e.g., you cannot list a new professor before class assignments are made). |
| Deletion Anomaly | Deleting one row causes other facts to disappear as well. |

Normalization is about preventing structures where these anomalies occur in advance. The concept emerged alongside Codd's relational model in 1970. 1NF was introduced then, while 2NF and 3NF were defined in 1971, and BCNF was defined by Codd and Boyce in 1974.

## Direct Example: Writing Everything in One Table

I created a small table using SQLite with two orders where the keyboard appears twice.

```sql
CREATE TABLE flat(order_id INT, customer TEXT, email TEXT,
                  product TEXT, price INT, qty INT);
INSERT INTO flat VALUES
 (1,'민수','m@x.com','키보드',50000,1),
 (1,'민수','m@x.com','마우스',20000,2),
 (2,'지영','j@x.com','키보드',50000,1);
-- 2번 주문의 키보드 가격만 고쳤다
UPDATE flat SET price=55000 WHERE order_id=2 AND product='키보드';
SELECT DISTINCT price FROM flat WHERE product='키보드';
```

The result was two rows: 50000 and 55000, meaning the keyboard price became duplicated. This is how an update anomaly arises.

## 1NF, 2NF, 3NF

If we summarize the three stages in one line, it looks like this.

| Stage | Rule | What happens if violated |
|---|---|---|
| 1NF | One value per cell; do not create repeating cells (Category1, Category2, etc.) | If there are three items, you must add a column. |
| 2NF | If there is more than one key, remove values that depend only on part of the key. | Product price repeats on every order row. |
| 3NF | Ensure no dependency between non-key values. | Discount rate repeats on every row due to customer tier. |

The student example in Microsoft documentation illustrates this well. Initially, there is a table with Class1, Class2, and Class3 columns. In 1NF, classes are written out one per row. In 2NF, student information and enrollment information are separated. In 3NF, since Adv-Room (advisor room number) is a value belonging to the professor rather than the student, it is moved to the Faculty table.

I often confused 2NF and 3NF, so I memorized them like this: 2NF asks "Does it depend on the whole key?", while 3NF asks "Does it depend only on the key (without passing through other general columns)?". According to the Wikipedia definition, 3NF is a state where there are no transitive dependencies among non-key attributes.

<details>
<summary>Detailed Explanation: Result of splitting the order example up to 3NF</summary>

Splitting the flat table above results in four tables: customer, product, order, and order item.

```sql
CREATE TABLE customer(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE);
CREATE TABLE product(id INTEGER PRIMARY KEY, name TEXT, price INT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,
                    customer_id INT REFERENCES customer(id));
CREATE TABLE order_item(
  order_id INT REFERENCES orders(id),
  product_id INT REFERENCES product(id),
  qty INT, unit_price INT,
  PRIMARY KEY(order_id, product_id));
```

Three things were verified by running it:

- Changing only one `product` row results in a single keyboard price of 55000.
- Attempting to place an order for a non-existent customer (99) triggers a `FOREIGN KEY constraint failed` error (SQLite requires `PRAGMA foreign_keys=ON` to be enabled).
- Rejoining the order, customer, and product tables with JOIN produces content identical to the original flat table.

The separate `unit_price` in `order_item` was intentional. Even if the product price changes later, past orders must retain the price at the time of ordering. Although this looks like redundancy, it represents a "fact at the time of order" and is therefore a different value. This design decision was made while building the example, not from reading documentation.

</details>

## Drawing an ERD

Modeling involves drawing what exists and how things are connected before splitting tables. The diagram is called an ERD (Entity-Relationship Diagram). The sequence was determined as follows:

1. Extract nouns: customer, product, order.
2. List attributes for each noun: customer has name and email.
3. Determine relationship cardinality: one customer can have many orders (1:N), and orders and products have a many-to-many relationship (N:M).
4. Resolve N:M relationships with an intermediate table: hence `order_item` is created.

Drawing it in text looks like this.

```
customer 1 ──< orders 1 ──< order_item >── 1 product
```

The `──<` symbol represents the "many" side. It's said that instead of memorizing normalization, resolving N:M relationships in an ERD and placing attributes in their proper positions usually gets you close to 3NF. This isn't something I personally verified, but rather a feeling gained from drawing it by hand.

## Denormalization

Normalization increases the number of tables and requires more JOINs when reading data. Microsoft documentation also notes that adhering strictly to 3NF can lead to many small tables appearing sequentially (e.g., city, postal code, contact person), potentially degrading performance. It also suggests applying 3NF only to frequently changing data.

Therefore, deliberately allowing redundancy is called denormalization. For example:

- Store the total amount in the order table in advance and do not calculate the sum on the list screen.
- Include a comment count column in the post table.

Instead, you must directly handle the code to update values so they remain consistent. This approach is used when reads are overwhelmingly high and JOINs have been identified as a bottleneck; it seems logical to first check if an [index](#/post/db-index) resolves the issue. Methods for storing separate values to reduce read load continue in the article about [cache](#/post/db-cache-redis).

## Common Misconceptions

- Normalization is better with more splits: Documents often state that 3NF is the highest level needed for most applications, and levels above it (4NF, 5NF) are rarely considered in practice.
- Normalization slows things down: It is true that JOINs may increase and slow performance, but this should be measured and verified. The cost of inconsistency caused by redundancy must also be taken into account.
- Denormalization is a design mistake: Deliberate denormalization is a choice; unintended redundancy is the problem.
- NoSQL means normalization is unnecessary: Document databases often use modeling that intentionally groups data for storage. This topic is covered in the [NoSQL article](#/post/db-nosql).

Note that Microsoft documents refer to 4NF as BCNF, whereas Wikipedia treats BCNF as a separate form stricter than 3NF. Since they differ in terminology, here we interpret BCNF according to the Wikipedia explanation. Methods for handling relationships between tables using SQL are covered in [Relational Databases and SQL](#/post/db-rdb-sql), while fixing split tables at once is addressed in [Transactions](#/post/db-transaction).

## Reference Links

- Microsoft Learn, Database normalization description: https://learn.microsoft.com/en-us/office/troubleshoot/access/database-normalization-description
- Wikipedia, Database normalization: https://en.wikipedia.org/wiki/Database_normalization

← Concept map (#/post/db-map)

Related articles: [Relational Databases and SQL](#/post/db-rdb-sql) · [Index](#/post/db-index) · [NoSQL](#/post/db-nosql)