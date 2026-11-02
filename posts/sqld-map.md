SQLD 공부 노트 열 편을 한자리에 모았다. 1과목은 설계(모델링), 2과목은 SQL이다. 시험 일정·응시료는 바뀌니 공식 사이트에서 확인한다.

## 한눈에 보는 순서

```
1과목 데이터 모델링의 이해
 모델링 → 엔터티·속성 → 관계·식별자 → 정규화·성능
2과목 SQL 기본 및 활용
 SELECT·함수 → 조인·서브쿼리 → GROUP BY·집합 → 윈도우·고급 → DML·DDL → DCL·절차형
```

## 1과목. 데이터 모델링

**모델링 단계와 ERD**: 개념·논리·물리 단계와 3단계 스키마를 구분한다.
[자세히 → 데이터 모델링의 이해](#/post/sqld-modeling)

**엔터티와 속성**: 분류 기준과 특징을 잡는다.
[자세히 → 엔터티와 속성](#/post/sqld-entity-attr)

**관계와 식별자**: 관계는 차수·선택성, 식별자는 PK의 출처로 나눠 본다.
[자세히 → 관계와 식별자](#/post/sqld-relation-identifier)

**정규화와 성능**: 중복을 걷어내는 정규화와 일부러 되돌리는 반정규화.
[자세히 → 정규화와 성능 데이터 모델링](#/post/sqld-norm-perf)

## 2과목. SQL 기본 및 활용

**SELECT와 함수**: 쓰는 순서와 실행 순서, NULL 처리.
[자세히 → SELECT와 함수](#/post/sqld-select-func)

**조인과 서브쿼리**: 표를 붙이는 일과 쿼리 안의 쿼리.
[자세히 → 조인과 서브쿼리](#/post/sqld-join-subquery)

**GROUP BY와 집합 연산**: 집계, ROLLUP·CUBE, UNION 계열.
[자세히 → GROUP BY와 집합 연산](#/post/sqld-group-set)

**윈도우 함수와 고급 SQL**: 순위·LAG, TOP N, 계층형, PIVOT.
[자세히 → 윈도우 함수와 고급 SQL](#/post/sqld-window-advanced)

**DML·TCL·DDL과 제약조건**: 데이터 변경, 확정, 구조 정의.
[자세히 → DML·TCL·DDL과 제약조건](#/post/sqld-dml-ddl)

**DCL과 절차형 SQL**: 권한 부여와 저장 프로그램.
[자세히 → DCL과 절차형 SQL](#/post/sqld-dcl-procedure)

## 관련 글

[DB map](#/post/db-map)에서 인덱스·트랜잭션 같은 실무 쪽 DB 글을 볼 수 있다.
